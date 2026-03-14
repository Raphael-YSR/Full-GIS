/* ═══════════════════════════════════════════════════
   TWWDA — Project API Routes
   ═══════════════════════════════════════════════════ */

import { Router } from "express";
import { withDb } from "./db.js";

const isProd = process.env.NODE_ENV === "production";

export default function createProjectRouter(requireAuth, superAdminAuth) {
  const router = Router();

  // GET /gis/projects/locations — Public map data
  router.get("/gis/projects/locations", async (req, res) => {
    try {
      const rows = await withDb((client) =>
        client.query(`
          SELECT
            p.id,
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
            AND ST_GeometryType(p.hashed_location::geometry) = 'ST_Point'
        `),
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching project locations:", err.stack);
      res.status(500).json({
        error: "Internal Server Error fetching locations",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/countyBounds — Public county boundaries GeoJSON
  router.get("/gis/countyBounds", async (req, res) => {
    try {
      const rows = await withDb((client) =>
        client.query(`
          SELECT id, county_name, ST_AsGeoJSON(geom)::json AS geometry
          FROM public.county
          WHERE geom IS NOT NULL
        `),
      );
      if (rows.length === 0)
        return res.status(404).json({ error: "No counties found" });
      res.json({
        type: "FeatureCollection",
        features: rows.map((row) => ({
          type: "Feature",
          geometry: row.geometry,
          properties: { id: row.id, county_name: row.county_name },
        })),
      });
    } catch (err) {
      console.error("County bounds error:", err);
      res.status(500).json({
        error: "Error fetching county boundaries",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/counties — Dropdown data
  router.get("/gis/counties", requireAuth, async (req, res) => {
    try {
      const rows = await withDb((client) =>
        client.query(
          "SELECT id, county_name FROM public.county ORDER BY county_name",
        ),
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching counties:", err);
      res.status(500).json({
        error: "Server error fetching counties.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/statuses — Dropdown data
  router.get("/gis/statuses", requireAuth, async (req, res) => {
    try {
      const rows = await withDb((client) =>
        client.query("SELECT id, status FROM public.status ORDER BY status"),
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching statuses:", err);
      res.status(500).json({
        error: "Server error fetching statuses.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/types — Dropdown data
  router.get("/gis/types", requireAuth, async (req, res) => {
    try {
      const rows = await withDb((client) =>
        client.query("SELECT id, type FROM public.type ORDER BY type"),
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching types:", err);
      res.status(500).json({
        error: "Server error fetching types.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/api/search — Search projects
  router.get("/gis/api/search", requireAuth, async (req, res) => {
    const query = req.query.q;
    if (!query)
      return res
        .status(400)
        .json({ error: "Search query parameter 'q' is required." });

    try {
      const rows = await withDb((client) =>
        client.query(
          `SELECT p.id, p.project_name, c.county_name AS county, p.progress,
                  s.status, t.type AS project_type_name, p.description
           FROM public.project p
           JOIN public.county c ON p.county_id = c.id
           JOIN public.status s ON p.project_status = s.id
           JOIN public.type t ON p.project_type = t.id
           WHERE p.project_name ILIKE $1 OR p.description ILIKE $1
           ORDER BY p.project_name
           LIMIT 50`,
          [`%${query}%`],
        ),
      );
      res.json(rows);
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({
        error: "Internal server error during search",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/projects/:id — Single project
  router.get("/gis/projects/:id", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID format." });

    try {
      const rows = await withDb((client) =>
        client.query(
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
        ),
      );
      if (rows.length === 0)
        return res
          .status(404)
          .json({ error: `Project with ID ${projectId} not found.` });
      res.json(rows[0]);
    } catch (err) {
      console.error(`Error fetching project ${projectId}:`, err);
      res.status(500).json({
        error: "Error fetching project details.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // POST /gis/projects — Add project
  router.post("/gis/projects", requireAuth, async (req, res) => {
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

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (isNaN(lat) || isNaN(lon))
      return res.status(400).json({ error: "Invalid latitude or longitude." });
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
      return res
        .status(400)
        .json({ error: "Latitude or longitude out of range." });

    try {
      const projectRows = await withDb((client) =>
        client.query(
          `INSERT INTO public.project
             (county_id, project_status, project_type, description, people_served, hashed_location, progress, project_name)
           VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326), $7, $8)
           RETURNING id`,
          [
            county_id,
            project_status,
            project_type,
            description || null,
            people_served || null,
            `POINT(${lon} ${lat})`,
            progress || null,
            project_name,
          ],
        ),
      );
      const newProjectId = projectRows[0].id;
      await withDb((client) =>
        client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            req.session.user.id,
            "ADD_PROJECT",
            `Added project: '${project_name}'`,
          ],
        ),
      );
      res
        .status(201)
        .json({
          message: `Project '${project_name}' has been added!`,
          id: newProjectId,
        });
    } catch (err) {
      console.error("Error adding project:", err);
      if (err.code === "23505")
        return res.status(409).json({ error: "Project name already exists." });
      res.status(500).json({
        error: "Error adding project.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // PUT /gis/projects/:id — Update project
  router.put("/gis/projects/:id", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID format." });

    const { project_status, description, progress, latitude, longitude } =
      req.body;

    if (!project_status || !latitude || !longitude) {
      return res.status(400).json({
        error:
          "Missing required fields: Status, Latitude, and Longitude are mandatory.",
      });
    }

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

    try {
      const rows = await withDb((client) =>
        client.query(
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
            `POINT(${lon} ${lat})`,
            projectId,
          ],
        ),
      );
      if (rows.length === 0)
        return res.status(404).json({ error: "Project not found." });
      await withDb((client) =>
        client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            req.session.user.id,
            "UPDATE_PROJECT",
            `Updated project: '${rows[0].project_name}' (ID: ${projectId})`,
          ],
        ),
      );
      res.json({
        message: `Project '${rows[0].project_name}' updated successfully!`,
      });
    } catch (err) {
      console.error(`Error updating project ${projectId}:`, err);
      res.status(500).json({
        error: "Internal server error during update.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/projects/:id — Delete project (superadmin only)
  router.delete(
    "/gis/projects/:id",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId))
        return res.status(400).json({ error: "Invalid project ID format." });

      try {
        const rows = await withDb((client) =>
          client.query(
            "DELETE FROM public.project WHERE id = $1 RETURNING project_name",
            [projectId],
          ),
        );
        if (rows.length === 0)
          return res.status(404).json({
            error: `Project with ID ${projectId} not found for deletion.`,
          });
        await withDb((client) =>
          client.query(
            "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
            [
              req.session.user.id,
              "DELETE_PROJECT",
              `Deleted project: '${rows[0].project_name}' (ID: ${projectId})`,
            ],
          ),
        );
        res.json({
          message: `Project '${rows[0].project_name}' (ID: ${projectId}) deleted successfully!`,
        });
      } catch (err) {
        console.error(`Error deleting project ${projectId}:`, err);
        if (err.code === "23503")
          return res.status(409).json({
            error: "Cannot delete project because it is referenced elsewhere.",
          });
        res.status(500).json({
          error: "Error deleting project.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // ARTICLE ROUTES
  // ─────────────────────────────────────────────────────────────

  // GET /projects/:id/article — Public: fetch full article + blocks
  router.get("/projects/:id/article", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID." });

    try {
      // Fetch project core info + article meta in one query
      const projectRows = await withDb((client) =>
        client.query(
          `SELECT
             p.id,
             p.project_name,
             p.description,
             p.people_served,
             p.progress,
             c.county_name AS county,
             s.status,
             t.type AS project_type,
             pa.id AS article_id,
             pa.hero_image_url,
             pa.published_at,
             pa.updated_at
           FROM public.project p
           JOIN public.county c ON p.county_id = c.id
           JOIN public.status s ON p.project_status = s.id
           JOIN public.type t ON p.project_type = t.id
           LEFT JOIN public.project_article pa ON pa.project_id = p.id
           WHERE p.id = $1`,
          [projectId],
        ),
      );

      if (projectRows.length === 0)
        return res.status(404).json({ error: "Project not found." });

      const project = projectRows[0];

      // If no article exists yet, return project info with empty article
      if (!project.article_id) {
        return res.json({
          ...project,
          article_id: null,
          hero_image_url: null,
          blocks: [],
        });
      }

      // Fetch ordered content blocks
      const blocks = await withDb((client) =>
        client.query(
          `SELECT id, block_type, content, sort_order
           FROM public.project_content_block
           WHERE article_id = $1
           ORDER BY sort_order ASC`,
          [project.article_id],
        ),
      );

      res.json({ ...project, blocks });
    } catch (err) {
      console.error(`Error fetching article for project ${projectId}:`, err);
      res.status(500).json({
        error: "Error fetching project article.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // POST /projects/:id/article — Protected: create article + blocks
  router.post("/projects/:id/article", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID." });

    const { hero_image_url, blocks } = req.body;
    // blocks: [{ block_type: 'paragraph'|'image', content: '...', sort_order: 0 }, ...]

    try {
      // Verify project exists
      const projectRows = await withDb((client) =>
        client.query(
          "SELECT id, project_name FROM public.project WHERE id = $1",
          [projectId],
        ),
      );
      if (projectRows.length === 0)
        return res.status(404).json({ error: "Project not found." });

      // Check if article already exists for this project
      const existing = await withDb((client) =>
        client.query(
          "SELECT id FROM public.project_article WHERE project_id = $1",
          [projectId],
        ),
      );
      if (existing.length > 0)
        return res
          .status(409)
          .json({
            error:
              "Article already exists for this project. Use PUT to update.",
          });

      // Insert article
      const articleRows = await withDb((client) =>
        client.query(
          `INSERT INTO public.project_article (project_id, hero_image_url)
           VALUES ($1, $2)
           RETURNING id`,
          [projectId, hero_image_url || null],
        ),
      );
      const articleId = articleRows[0].id;

      // Insert content blocks if provided
      if (Array.isArray(blocks) && blocks.length > 0) {
        for (const block of blocks) {
          if (
            !block.content ||
            !["paragraph", "image"].includes(block.block_type)
          )
            continue;
          await withDb((client) =>
            client.query(
              `INSERT INTO public.project_content_block (article_id, block_type, content, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [
                articleId,
                block.block_type,
                block.content,
                block.sort_order ?? 0,
              ],
            ),
          );
        }
      }

      await withDb((client) =>
        client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            req.session.user.id,
            "ADD_ARTICLE",
            `Added article for project: '${projectRows[0].project_name}' (ID: ${projectId})`,
          ],
        ),
      );

      res
        .status(201)
        .json({
          message: "Article created successfully.",
          article_id: articleId,
        });
    } catch (err) {
      console.error(`Error creating article for project ${projectId}:`, err);
      res.status(500).json({
        error: "Error creating article.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // PUT /projects/:id/article — Protected: replace article content entirely
  router.put("/projects/:id/article", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId))
      return res.status(400).json({ error: "Invalid project ID." });

    const { hero_image_url, blocks } = req.body;

    try {
      // Get the article for this project
      const articleRows = await withDb((client) =>
        client.query(
          `SELECT pa.id FROM public.project_article pa
           JOIN public.project p ON p.id = pa.project_id
           WHERE pa.project_id = $1`,
          [projectId],
        ),
      );
      if (articleRows.length === 0)
        return res
          .status(404)
          .json({ error: "No article found for this project." });

      const articleId = articleRows[0].id;

      // Update hero image
      await withDb((client) =>
        client.query(
          `UPDATE public.project_article SET hero_image_url = $1 WHERE id = $2`,
          [hero_image_url || null, articleId],
        ),
      );

      // Replace all blocks: delete existing, re-insert
      await withDb((client) =>
        client.query(
          "DELETE FROM public.project_content_block WHERE article_id = $1",
          [articleId],
        ),
      );

      if (Array.isArray(blocks) && blocks.length > 0) {
        for (const block of blocks) {
          if (
            !block.content ||
            !["paragraph", "image"].includes(block.block_type)
          )
            continue;
          await withDb((client) =>
            client.query(
              `INSERT INTO public.project_content_block (article_id, block_type, content, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [
                articleId,
                block.block_type,
                block.content,
                block.sort_order ?? 0,
              ],
            ),
          );
        }
      }

      await withDb((client) =>
        client.query(
          "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
          [
            req.session.user.id,
            "UPDATE_ARTICLE",
            `Updated article for project ID: ${projectId}`,
          ],
        ),
      );

      res.json({ message: "Article updated successfully." });
    } catch (err) {
      console.error(`Error updating article for project ${projectId}:`, err);
      res.status(500).json({
        error: "Error updating article.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  return router;
}
