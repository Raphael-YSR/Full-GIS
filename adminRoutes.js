/* ═══════════════════════════════════════════════════
   TWWDA — Admin API Routes
   ═══════════════════════════════════════════════════ */

import { Router } from "express";
import bcrypt from "bcrypt";
import { withDb } from "./db.js";

const isProd = process.env.NODE_ENV === "production";

export default function createAdminRouter(requireAuth, superAdminAuth) {
  const router = Router();

  // GET /gis/departments — Dropdown data (superadmin only)
  router.get(
    "/gis/departments",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      try {
        const rows = await withDb((client) =>
          client.query(
            "SELECT id, department_name FROM admin.department ORDER BY department_name",
          ),
        );
        res.json(rows);
      } catch (err) {
        console.error("Error fetching departments:", err);
        res.status(500).json({
          error: "Error fetching departments.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // GET /gis/admins/search — Search admins
  router.get(
    "/gis/admins/search",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const query = req.query.q;
      if (!query)
        return res
          .status(400)
          .json({ error: "Search query parameter 'q' is required." });
      if (query.length < 2) return res.status(200).json([]);

      try {
        const rows = await withDb((client) =>
          client.query(
            `SELECT a.id, a.fname AS f_name, a.lname AS l_name, a.email, d.department_name
             FROM admin.admin a
             LEFT JOIN admin.department d ON a.department_id = d.id
             WHERE a.fname ILIKE $1 OR a.lname ILIKE $1 OR a.email ILIKE $1
             ORDER BY a.lname, a.fname
             LIMIT 50`,
            [`%${query}%`],
          ),
        );
        res.json(rows);
      } catch (err) {
        console.error("Admin search error:", err);
        res.status(500).json({
          error: "Internal server error during admin search",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // GET /gis/admins/:id — Single admin details
  router.get(
    "/gis/admins/:id",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const adminId = parseInt(req.params.id, 10);
      if (isNaN(adminId))
        return res.status(400).json({ error: "Invalid admin ID format." });

      try {
        const rows = await withDb((client) =>
          client.query(
            `SELECT a.id, a.fname AS f_name, a.lname AS l_name, a.email, a.last_login, d.department_name
             FROM admin.admin a
             LEFT JOIN admin.department d ON a.department_id = d.id
             WHERE a.id = $1`,
            [adminId],
          ),
        );
        if (rows.length === 0)
          return res.status(404).json({ error: "Administrator not found." });
        res.json(rows[0]);
      } catch (err) {
        console.error(`Error fetching admin ${adminId}:`, err);
        res.status(500).json({
          error: "An error occurred while fetching admin details.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // POST /gis/admins — Add admin
  router.post("/gis/admins", requireAuth, superAdminAuth, async (req, res) => {
    const { email, password, f_name, l_name, department_id } = req.body;
    if (!email || !password || !f_name || !l_name || !department_id)
      return res.status(400).json({ error: "Missing required fields." });

    try {
      const existing = await withDb((client) =>
        client.query("SELECT id FROM admin.admin WHERE email = $1", [email]),
      );
      if (existing.length > 0)
        return res.status(409).json({ error: "Email address already exists." });

      const hashedPassword = await bcrypt.hash(password, 10);
      const rows = await withDb((client) =>
        client.query(
          `INSERT INTO admin.admin (hashed_pass, email, fname, lname, is_active, department_id, role_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, email, fname AS f_name, lname AS l_name, is_active, department_id, role_id`,
          [hashedPassword, email, f_name, l_name, true, department_id, 1],
        ),
      );
      await withDb((client) =>
        client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            req.session.user.id,
            "ADD_ADMIN",
            `Added administrator: '${f_name} ${l_name}' (${email})`,
          ],
        ),
      );
      res.status(201).json({
        message: `Administrator '${f_name} ${l_name}' has been added!`,
        admin: rows[0],
      });
    } catch (err) {
      console.error("Error adding administrator:", err);
      if (err.code === "23503")
        return res.status(400).json({ error: "Invalid department ID." });
      res.status(500).json({
        error: "Error adding administrator.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/admins/:id — Delete admin
  router.delete(
    "/gis/admins/:id",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const adminId = parseInt(req.params.id, 10);
      if (isNaN(adminId))
        return res.status(400).json({ error: "Invalid admin ID format." });

      if (adminId === req.session.user.id)
        return res
          .status(400)
          .json({ error: "You cannot delete your own account." });

      try {
        const rows = await withDb((client) =>
          client.query(
            "DELETE FROM admin.admin WHERE id = $1 RETURNING fname AS f_name, lname AS l_name",
            [adminId],
          ),
        );
        if (rows.length === 0)
          return res.status(404).json({ error: "Administrator not found." });

        // Audit log
        await withDb((client) =>
          client.query(
            "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
            [
              req.session.user.id,
              "DELETE_ADMIN",
              `Deleted admin: ${rows[0].f_name} ${rows[0].l_name}`,
            ],
          ),
        );

        res.json({ message: "Administrator account deleted successfully." });
      } catch (err) {
        console.error(`Error deleting admin ${adminId}:`, err);
        res.status(500).json({
          error: "Database error during deletion.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // POST /gis/admins/:id/reset-password — Reset admin password
  router.post(
    "/gis/admins/:id/reset-password",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const adminId = parseInt(req.params.id, 10);
      if (isNaN(adminId))
        return res.status(400).json({ error: "Invalid admin ID format." });

      const { password } = req.body;
      if (!password || password.length < 8)
        return res
          .status(400)
          .json({ error: "Password must be at least 8 characters long." });

      try {
        const existing = await withDb((client) =>
          client.query("SELECT id FROM admin.admin WHERE id = $1", [adminId]),
        );
        if (existing.length === 0)
          return res.status(404).json({ error: "Admin not found." });

        const hashedPassword = await bcrypt.hash(password, 12);
        const rows = await withDb((client) =>
          client.query(
            "UPDATE admin.admin SET hashed_pass = $1, last_password_change = NOW() WHERE id = $2 RETURNING id",
            [hashedPassword, adminId],
          ),
        );
        if (rows.length === 0)
          return res.status(500).json({ error: "Failed to update password." });

        // Audit log
        await withDb((client) =>
          client.query(
            "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
            [
              req.session.user.id,
              "PASSWORD_RESET",
              `Reset password for admin ID: ${adminId}`,
            ],
          ),
        );

        res.json({ message: "Password reset successful." });
      } catch (err) {
        console.error(`Error resetting password for admin ${adminId}:`, err);
        res.status(500).json({
          error: "An error occurred while resetting the password.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  return router;
}
