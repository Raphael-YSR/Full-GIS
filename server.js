import express from "express";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import cors from "cors";
import pgSession from "connect-pg-simple";
import cookieParser from "cookie-parser";
import createRouter from "./routes.js";

// --- Load environment variables ---
dotenv.config();

// --- Initialize app ---
const app = express();
const port = process.env.PORT || 3000;

// --- Setup PostgreSQL Pool ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Setup Session Store ---
const pgStore = pgSession(session);

// --- Middleware ---
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      "https://full-gis.onrender.com",
      "http://localhost:3000",
    ];
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log("CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Session ---
app.use(
  session({
    store: new pgStore({
      pool: pool,
      tableName: "user_sessions",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
    proxy: true,
  }),
);

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

// --- Auth Middleware ---
// Defined BEFORE routes so they can be passed into createRouter()

// 1. Protect admin routes
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    req.session.returnTo = req.originalUrl;
    res.redirect("/gis/login");
  }
};

// 2. Superadmin only
const superAdminAuth = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.roleId === 2) {
    return next();
  }
  if (req.xhr || req.headers.accept.indexOf("json") > -1) {
    return res.status(403).json({ error: "Superadmin privileges required" });
  }
  return res.redirect("/gis/admin?error=superadmin");
};

// --- Page Routes ---
// Pass auth middleware into the router factory
app.use(createRouter(requireAuth, superAdminAuth));

// --- API Routes ---

// 0. Uptime monitoring
app.get("/health", (req, res) => res.status(200).send("OK"));

// 1. Login form submission
app.post("/gis/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT * FROM admin.admin WHERE email = $1",
      [email],
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (!user.hashed_pass) {
        console.error(`User ${email} found but has no hashed_pass defined.`);
        return res.status(500).json({ error: "Server configuration error" });
      }

      const passwordMatch = await bcrypt.compare(password, user.hashed_pass);

      if (passwordMatch) {
        req.session.user = {
          id: user.id,
          email: user.email,
          roleId: user.role_id,
        };

        client
          .query("UPDATE admin.admin SET last_login = NOW() WHERE id = $1", [
            user.id,
          ])
          .catch((err) =>
            console.error("Failed to update last login time:", err),
          );

        try {
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          const returnTo = req.session.returnTo || "/gis/admin";
          delete req.session.returnTo;
          return res.json({ success: true, redirectTo: returnTo });
        } catch (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).json({ error: "Session error" });
        }
      } else {
        return res.status(401).json({ error: "Incorrect email or password" });
      }
    } else {
      return res.status(401).json({ error: "Incorrect email or password" });
    }
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (client) client.release();
  }
});

// 2. Logout
app.get("/gis/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error logging out");
    }
    res.redirect("/gis");
  });
});

// 3. Public map data
app.get("/gis/projects/locations", async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const sql = `
      SELECT
        p.project_name,
        p.description,
        s.status,
        p.progress,
        c.county_name AS county,
        t.type AS project_type,
        ST_Y(p.hashed_location::geometry) AS lat,
        ST_X(p.hashed_location::geometry) AS lng
      FROM public.project p
      JOIN public.county c ON p.county_id = c.id
      JOIN public.status s ON p.project_status = s.id
      JOIN public.type t ON p.project_type = t.id
      WHERE
        p.hashed_location IS NOT NULL
        AND ST_GeometryType(p.hashed_location::geometry) = 'ST_Point';
    `;
    const result = await client.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching project locations:", err.stack);
    res.status(500).json({
      error: "Internal Server Error fetching locations",
      details: err.message,
    });
  } finally {
    if (client) client.release();
  }
});

// 4. County boundaries GeoJSON
app.get("/gis/countyBounds", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, county_name, ST_AsGeoJSON(geom)::json AS geometry
      FROM public.county
      WHERE geom IS NOT NULL
    `);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No counties found" });
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map((row) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: { id: row.id, county_name: row.county_name },
      })),
    };
    res.json(geojson);
  } catch (err) {
    console.error("Query Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Protected API Endpoints ---

const isProd = process.env.NODE_ENV === "production";

// 5. Add project
app.post("/gis/projects", requireAuth, async (req, res) => {
  const {
    county_id,
    project_status,
    project_type,
    description,
    people_served,
    latitude,
    longitude,
    progress,
    project_name,
  } = req.body;

  if (
    !project_name ||
    !county_id ||
    !project_status ||
    !project_type ||
    !latitude ||
    !longitude
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  let client;
  try {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (isNaN(lat) || isNaN(lon))
      return res.status(400).json({ error: "Invalid latitude or longitude." });
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
      return res
        .status(400)
        .json({ error: "Latitude or longitude out of range." });

    const hashed_location = `POINT(${lon} ${lat})`;
    client = await pool.connect();
    await client.query(
      `INSERT INTO public.project (county_id, project_status, project_type, description, people_served, hashed_location, progress, project_name)
       VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326), $7, $8)`,
      [
        county_id,
        project_status,
        project_type,
        description || null,
        people_served || null,
        hashed_location,
        progress || null,
        project_name,
      ],
    );
    res
      .status(201)
      .json({ message: `Project '${project_name}' has been added!` });
  } catch (err) {
    console.error("Error adding project:", err);
    if (err.code === "23505")
      return res.status(409).json({ error: "Project name already exists." });
    res
      .status(500)
      .json({ error: "Error adding project.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

// 6. Get counties
app.get("/gis/counties", requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, county_name FROM public.county ORDER BY county_name",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching counties:", err);
    res.status(500).json({
      error: "Server error fetching counties.",
      ...(isProd ? {} : { details: err.message }),
    });
  } finally {
    if (client) client.release();
  }
});

// 7. Get statuses
app.get("/gis/statuses", requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, status FROM public.status ORDER BY status",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching statuses:", err);
    res.status(500).json({
      error: "Server error fetching Statuses.",
      ...(isProd ? {} : { details: err.message }),
    });
  } finally {
    if (client) client.release();
  }
});

// 8. Get types
app.get("/gis/types", requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, type FROM public.type ORDER BY type",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching types:", err);
    res.status(500).json({
      error: "Server error fetching Types.",
      ...(isProd ? {} : { details: err.message }),
    });
  } finally {
    if (client) client.release();
  }
});

// 9. Get departments
app.get("/gis/departments", requireAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, department_name FROM admin.department ORDER BY department_name",
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res
      .status(500)
      .json({ error: "Error fetching departments.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

// 10. Search projects
app.get("/gis/api/search", requireAuth, async (req, res) => {
  const query = req.query.q;
  if (!query)
    return res
      .status(400)
      .json({ error: "Search query parameter 'q' is required." });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT p.id, p.project_name, c.county_name AS county, p.progress, s.status, t.type AS project_type_name, p.description
       FROM public.project p
       JOIN public.county c ON p.county_id = c.id
       JOIN public.status s ON p.project_status = s.id
       JOIN public.type t ON p.project_type = t.id
       WHERE p.project_name ILIKE $1 OR p.description ILIKE $1
       ORDER BY p.project_name
       LIMIT 50`,
      [`%${query}%`],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Search Database error:", err);
    res.status(500).json({
      error: "Internal server error during search",
      details: err.message,
    });
  } finally {
    if (client) client.release();
  }
});

// 11. Search admins
app.get("/gis/admins/search", requireAuth, superAdminAuth, async (req, res) => {
  const query = req.query.q;
  if (!query)
    return res
      .status(400)
      .json({ error: "Search query parameter 'q' is required." });
  if (query.length < 2) return res.status(200).json([]);

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT a.id, a.fname AS f_name, a.lname AS l_name, a.email, d.department_name
       FROM admin.admin a
       LEFT JOIN admin.department d ON a.department_id = d.id
       WHERE a.fname ILIKE $1 OR a.lname ILIKE $1 OR a.email ILIKE $1
       ORDER BY a.lname, a.fname
       LIMIT 50`,
      [`%${query}%`],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Admin Search Database error:", err);
    res.status(500).json({
      error: "Internal server error during admin search",
      details: err.message,
    });
  } finally {
    if (client) client.release();
  }
});

// 12. Get single project
app.get("/gis/project/:id", requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId))
    return res.status(400).json({ error: "Invalid project ID format." });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT p.id, p.project_name, p.county_id, p.project_status, p.project_type,
              c.county_name AS county, s.status, t.type AS project_type_name,
              p.description, p.people_served, p.progress,
              ST_Y(p.hashed_location::geometry) AS latitude,
              ST_X(p.hashed_location::geometry) AS longitude
       FROM public.project p
       JOIN public.county c ON p.county_id = c.id
       JOIN public.status s ON p.project_status = s.id
       JOIN public.type t ON p.project_type = t.id
       WHERE p.id = $1`,
      [projectId],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ error: `Project with ID ${projectId} not found.` });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Error fetching project ${projectId}:`, err);
    res
      .status(500)
      .json({ error: "Error fetching project details.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

// 13. Get single admin
app.get("/gis/admins/:id", requireAuth, superAdminAuth, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const adminId = parseInt(req.params.id, 10);
    if (isNaN(adminId))
      return res.status(400).json({ error: "Invalid admin ID format." });

    const result = await client.query(
      `SELECT a.id, a.f_name, a.l_name, a.email, a.last_login, d.department_name
         FROM admin.admin a
         LEFT JOIN admin.departments d ON a.department_id = d.id
         WHERE a.id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Administrator not found" });

    const admin = result.rows[0];
    delete admin.hashed_pass;
    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin details:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching admin details" });
  } finally {
    if (client) client.release();
  }
});

// 14. Update project
app.put("/gis/project/:id", requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId))
    return res.status(400).json({ error: "Invalid project ID format." });

  const {
    project_status,
    description,
    progress,
    latitude,
    longitude,
    // Removed project_name, county_id, and project_type because they aren't in your form
  } = req.body;

  // 1. Validate only what we need
  if (!project_status || !latitude || !longitude) {
    return res.status(400).json({
      error:
        "Missing required fields: Status, Latitude, and Longitude are mandatory.",
    });
  }

  let client;
  try {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      isNaN(lat) ||
      isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or out-of-range latitude or longitude." });
    }

    const hashed_location = `POINT(${lon} ${lat})`;
    client = await pool.connect();

    // 2. Updated SQL: Only update the fields that the admin is allowed to change in the form
    const result = await client.query(
      `UPDATE public.project
       SET project_status = $1,
           description = $2,
           progress = $3,
           hashed_location = ST_GeomFromText($4, 4326)
       WHERE id = $5
       RETURNING id, project_name`,
      [
        project_status,
        description || null,
        progress || 0,
        hashed_location,
        projectId,
      ],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Project not found." });

    res.json({
      message: `Project '${result.rows[0].project_name}' updated successfully!`,
    });
  } catch (err) {
    console.error(`Error updating project ${projectId}:`, err);
    res.status(500).json({ error: "Internal server error during update." });
  } finally {
    if (client) client.release();
  }
});

// 15. Delete project
app.delete(
  "/gis/project/:id",
  requireAuth,
  superAdminAuth,
  async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID format." });

    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        "DELETE FROM public.project WHERE id = $1 RETURNING project_name",
        [projectId],
      );
      if (result.rowCount === 0)
        return res.status(404).json({
          error: `Project with ID ${projectId} not found for deletion.`,
        });
      res.json({
        message: `Project '${result.rows[0].project_name}' (ID: ${projectId}) deleted successfully!`,
      });
    } catch (err) {
      console.error(`Error deleting project ${projectId}:`, err);
      if (err.code === "23503")
        return res.status(409).json({
          error: "Cannot delete project because it is referenced elsewhere.",
        });
      res
        .status(500)
        .json({ error: "Error deleting project.", details: err.message });
    } finally {
      if (client) client.release();
    }
  },
);

// 16. Add admin
app.post("/gis/admins", requireAuth, superAdminAuth, async (req, res) => {
  const { email, password, f_name, l_name, department_id } = req.body;
  if (!email || !password || !f_name || !l_name || !department_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  let client;
  try {
    client = await pool.connect();
    const emailCheckResult = await client.query(
      "SELECT id FROM admin.admin WHERE email = $1",
      [email],
    );
    if (emailCheckResult.rows.length > 0)
      return res.status(409).json({ error: "Email address already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO admin.admin (hashed_pass, email, fname, lname, is_active, department_id, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, fname, lname, is_active, department_id, role_id`,
      [hashedPassword, email, f_name, l_name, true, department_id, 1],
    );
    res.status(201).json({
      message: `Administrator '${f_name} ${l_name}' has been added!`,
      admin: result.rows[0],
    });
  } catch (err) {
    console.error("Error adding administrator:", err);
    if (err.code === "23503")
      return res.status(400).json({ error: "Invalid department ID." });
    res
      .status(500)
      .json({ error: "Error adding administrator.", details: err.message });
  } finally {
    if (client) client.release();
  }
});

// 17. Delete admin
app.delete("/gis/admins/:id", requireAuth, superAdminAuth, async (req, res) => {
  const adminId = parseInt(req.params.id, 10);

  // Prevent superadmin from deleting themselves
  if (adminId === req.session.user.id) {
    return res
      .status(400)
      .json({ error: "You cannot delete your own account." });
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "DELETE FROM admin.admin WHERE id = $1 RETURNING f_name, l_name",
      [adminId],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Administrator not found." });

    // Log the action
    await client.query(
      "INSERT INTO admin.audit_log (admin_id, action, details) VALUES ($1, $2, $3)",
      [
        req.session.user.id,
        "DELETE_ADMIN",
        `Deleted admin: ${result.rows[0].f_name} ${result.rows[0].l_name}`,
      ],
    );

    res.json({ message: "Administrator account deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Database error during deletion." });
  } finally {
    if (client) client.release();
  }
});

// 18. Reset admin password
app.post(
  "/gis/admins/:id/reset-password",
  requireAuth,
  superAdminAuth,
  async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      const adminId = parseInt(req.params.id, 10);
      if (isNaN(adminId))
        return res.status(400).json({ error: "Invalid admin ID format" });

      const { password } = req.body;
      if (!password || password.length < 8)
        return res
          .status(400)
          .json({ error: "Password must be at least 8 characters long" });

      const adminCheck = await client.query(
        "SELECT id FROM admin.admin WHERE id = $1",
        [adminId],
      );
      if (adminCheck.rows.length === 0)
        return res.status(404).json({ error: "Admin not found" });

      const hashedPassword = await bcrypt.hash(password, 12);
      const result = await client.query(
        "UPDATE admin.admin SET hashed_pass = $1, last_password_change = NOW() WHERE id = $2 RETURNING id",
        [hashedPassword, adminId],
      );
      if (result.rowCount === 0)
        return res.status(500).json({ error: "Failed to update password" });

      const performingAdminId = req.session.user?.id;
      if (performingAdminId) {
        await client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            performingAdminId,
            "PASSWORD_RESET",
            `Reset password for admin ID: ${adminId}`,
          ],
        );
      }
      res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res
        .status(500)
        .json({ error: "An error occurred while resetting the password" });
    } finally {
      if (client) client.release();
    }
  },
);

// --- Static File Serving (AFTER all routes) ---
app.use(express.static(path.join(__dirname, "docs")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

// --- Error Handling ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).send("Something broke!");
});

// --- Start Server ---
(async () => {
  let client;
  try {
    client = await pool.connect();
    console.log(">>> Initial database connection successful.");
    client.release();
    app.listen(port, () => {
      console.log(`>>> Server listening at ${port}`);
    });
  } catch (err) {
    console.error("FATAL: Initial database connection failed:", err);
    if (client) client.release();
    process.exit(1);
  }
})();
