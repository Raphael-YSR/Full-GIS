/* ═══════════════════════════════════════════════════
   TWWDA — Tender API Routes
   ═══════════════════════════════════════════════════ */

import { Router } from "express";
import { withDb } from "./db.js";

const isProd = process.env.NODE_ENV === "production";

export default function createTenderRouter(requireAuth, superAdminAuth) {
  const router = Router();

  // ============================================================
  // PUBLIC ROUTES (no auth required)
  // ============================================================

  // GET /gis/tenders — List all tenders (with pagination & filters)
  router.get("/gis/tenders", async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        search,
        sort = "-published_date",
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereClauses = [];
      let queryParams = [];
      let paramIndex = 1;

      if (status) {
        whereClauses.push(`t.status = $${paramIndex++}`);
        queryParams.push(status);
      }

      if (category) {
        whereClauses.push(`t.category = $${paramIndex++}`);
        queryParams.push(category);
      }

      if (search) {
        whereClauses.push(
          `(t.title ILIKE $${paramIndex++} OR t.reference_number ILIKE $${paramIndex++})`,
        );
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Get total count
      const countResult = await withDb((client) =>
        client.query(
          `SELECT COUNT(*) FROM public.tender t ${whereClause}`,
          queryParams.slice(0, paramIndex - 1),
        ),
      );
      const total = parseInt(countResult[0].count);

      // Order by
      let orderBy = "t.published_date DESC";
      if (sort === "published_date") orderBy = "t.published_date ASC";
      if (sort === "-published_date") orderBy = "t.published_date DESC";
      if (sort === "closing_date") orderBy = "t.closing_date ASC";
      if (sort === "-closing_date") orderBy = "t.closing_date DESC";

      // Get paginated results
      const tenders = await withDb((client) =>
        client.query(
          `SELECT t.id, t.title, t.slug, t.reference_number, t.description,
                  t.procurement_method, t.category, t.published_date,
                  t.closing_date, t.status, t.view_count,
                  (SELECT COUNT(*) FROM public.tender_document td WHERE td.tender_id = t.id) as document_count
           FROM public.tender t
           ${whereClause}
           ORDER BY ${orderBy}
           LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
          [...queryParams.slice(0, paramIndex - 3), parseInt(limit), offset],
        ),
      );

      res.json({
        data: tenders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error("Error fetching tenders:", err);
      res.status(500).json({
        error: "Error fetching tenders.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/tenders/:id — Get single tender with documents and paragraphs
  router.get("/gis/tenders/:id", async (req, res) => {
    const tenderId = parseInt(req.params.id, 10);
    if (isNaN(tenderId)) {
      return res.status(400).json({ error: "Invalid tender ID format." });
    }

    try {
      // Increment view count
      await withDb((client) =>
        client.query(
          "UPDATE public.tender SET view_count = view_count + 1 WHERE id = $1",
          [tenderId],
        ),
      );

      // Get tender details
      const tenderRows = await withDb((client) =>
        client.query(
          `SELECT t.id, t.title, t.slug, t.reference_number, t.description,
                  t.procurement_method, t.category, t.published_date,
                  t.closing_date, t.status, t.view_count, t.created_at,
                  t.updated_at, a.fname || ' ' || a.lname as created_by_name
           FROM public.tender t
           LEFT JOIN admin.admin a ON t.created_by = a.id
           WHERE t.id = $1`,
          [tenderId],
        ),
      );

      if (tenderRows.length === 0) {
        return res.status(404).json({ error: "Tender not found." });
      }

      const tender = tenderRows[0];

      // Get documents
      const documents = await withDb((client) =>
        client.query(
          `SELECT id, title, file_url, document_type, file_size, sort_order
           FROM public.tender_document
           WHERE tender_id = $1
           ORDER BY sort_order ASC`,
          [tenderId],
        ),
      );

      // Get paragraphs (rich content)
      const paragraphs = await withDb((client) =>
        client.query(
          `SELECT id, block_type, content, sort_order
           FROM public.tender_paragraph
           WHERE tender_id = $1
           ORDER BY sort_order ASC`,
          [tenderId],
        ),
      );

      res.json({
        ...tender,
        documents,
        paragraphs,
      });
    } catch (err) {
      console.error(`Error fetching tender ${tenderId}:`, err);
      res.status(500).json({
        error: "Error fetching tender details.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/tenders/:id/documents — Get only documents
  router.get("/gis/tenders/:id/documents", async (req, res) => {
    const tenderId = parseInt(req.params.id, 10);
    if (isNaN(tenderId)) {
      return res.status(400).json({ error: "Invalid tender ID format." });
    }

    try {
      const documents = await withDb((client) =>
        client.query(
          `SELECT id, title, file_url, document_type, file_size
           FROM public.tender_document
           WHERE tender_id = $1
           ORDER BY sort_order ASC`,
          [tenderId],
        ),
      );

      res.json(documents);
    } catch (err) {
      console.error(`Error fetching documents for tender ${tenderId}:`, err);
      res.status(500).json({
        error: "Error fetching documents.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // ============================================================
  // PROTECTED ROUTES (require auth)
  // ============================================================

  // POST /gis/tenders — Create new tender
  router.post("/gis/tenders", requireAuth, async (req, res) => {
    const {
      title,
      slug,
      reference_number,
      description,
      procurement_method,
      category,
      published_date,
      closing_date,
      status,
      documents,
      paragraphs,
    } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: "Title and slug are required." });
    }

    try {
      // Check for duplicate slug
      const existing = await withDb((client) =>
        client.query("SELECT id FROM public.tender WHERE slug = $1", [slug]),
      );

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "A tender with this slug already exists." });
      }

      // Insert tender
      const tenderRows = await withDb((client) =>
        client.query(
          `INSERT INTO public.tender
           (title, slug, reference_number, description, procurement_method,
            category, published_date, closing_date, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, title, slug, reference_number`,
          [
            title,
            slug,
            reference_number || null,
            description || null,
            procurement_method || null,
            category || null,
            published_date || new Date().toISOString().split("T")[0],
            closing_date || null,
            status || "open",
            req.session.user.id,
          ],
        ),
      );

      const newTenderId = tenderRows[0].id;

      // Insert documents
      if (documents && Array.isArray(documents) && documents.length > 0) {
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (doc.title && doc.file_url) {
            await withDb((client) =>
              client.query(
                `INSERT INTO public.tender_document
                 (tender_id, title, file_url, document_type, file_size, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  newTenderId,
                  doc.title,
                  doc.file_url,
                  doc.document_type || "PDF",
                  doc.file_size || null,
                  doc.sort_order || i,
                ],
              ),
            );
          }
        }
      }

      // Insert paragraphs (rich content)
      if (paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0) {
        for (let i = 0; i < paragraphs.length; i++) {
          const para = paragraphs[i];
          if (
            para.content &&
            ["paragraph", "image"].includes(para.block_type)
          ) {
            await withDb((client) =>
              client.query(
                `INSERT INTO public.tender_paragraph
                 (tender_id, block_type, content, sort_order)
                 VALUES ($1, $2, $3, $4)`,
                [
                  newTenderId,
                  para.block_type,
                  para.content,
                  para.sort_order || i,
                ],
              ),
            );
          }
        }
      }

      // Audit log
      await withDb((client) =>
        client.query(
          `INSERT INTO admin.audit_log (admin_id, action, details, date)
           VALUES ($1, $2, $3, NOW())`,
          [
            req.session.user.id,
            "ADD_TENDER",
            `Added tender: '${title}' (Ref: ${reference_number || slug})`,
          ],
        ),
      );

      res.status(201).json({
        message: `Tender '${title}' has been added successfully!`,
        id: newTenderId,
        tender: tenderRows[0],
      });
    } catch (err) {
      console.error("Error adding tender:", err);
      res.status(500).json({
        error: "Error adding tender.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // PUT /gis/tenders/:id — Update tender
  router.put("/gis/tenders/:id", requireAuth, async (req, res) => {
    const tenderId = parseInt(req.params.id, 10);
    if (isNaN(tenderId)) {
      return res.status(400).json({ error: "Invalid tender ID format." });
    }

    const {
      title,
      slug,
      reference_number,
      description,
      procurement_method,
      category,
      published_date,
      closing_date,
      status,
    } = req.body;

    try {
      // Check if tender exists
      const existingTender = await withDb((client) =>
        client.query("SELECT id, title FROM public.tender WHERE id = $1", [
          tenderId,
        ]),
      );

      if (existingTender.length === 0) {
        return res.status(404).json({ error: "Tender not found." });
      }

      // Check slug uniqueness (excluding current tender)
      if (slug) {
        const slugExists = await withDb((client) =>
          client.query(
            "SELECT id FROM public.tender WHERE slug = $1 AND id != $2",
            [slug, tenderId],
          ),
        );
        if (slugExists.length > 0) {
          return res
            .status(409)
            .json({ error: "Another tender already uses this slug." });
        }
      }

      // Update tender
      await withDb((client) =>
        client.query(
          `UPDATE public.tender
           SET title = COALESCE($1, title),
               slug = COALESCE($2, slug),
               reference_number = COALESCE($3, reference_number),
               description = COALESCE($4, description),
               procurement_method = COALESCE($5, procurement_method),
               category = COALESCE($6, category),
               published_date = COALESCE($7, published_date),
               closing_date = COALESCE($8, closing_date),
               status = COALESCE($9, status)
           WHERE id = $10`,
          [
            title,
            slug,
            reference_number,
            description,
            procurement_method,
            category,
            published_date,
            closing_date,
            status,
            tenderId,
          ],
        ),
      );

      // Audit log
      await withDb((client) =>
        client.query(
          `INSERT INTO admin.audit_log (admin_id, action, details, date)
           VALUES ($1, $2, $3, NOW())`,
          [
            req.session.user.id,
            "UPDATE_TENDER",
            `Updated tender: '${existingTender[0].title}' (ID: ${tenderId})`,
          ],
        ),
      );

      res.json({ message: "Tender updated successfully!" });
    } catch (err) {
      console.error(`Error updating tender ${tenderId}:`, err);
      res.status(500).json({
        error: "Error updating tender.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/tenders/:id — Delete tender (superadmin only)
  router.delete(
    "/gis/tenders/:id",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const tenderId = parseInt(req.params.id, 10);
      if (isNaN(tenderId)) {
        return res.status(400).json({ error: "Invalid tender ID format." });
      }

      try {
        const tender = await withDb((client) =>
          client.query("SELECT id, title FROM public.tender WHERE id = $1", [
            tenderId,
          ]),
        );

        if (tender.length === 0) {
          return res.status(404).json({ error: "Tender not found." });
        }

        await withDb((client) =>
          client.query("DELETE FROM public.tender WHERE id = $1", [tenderId]),
        );

        // Audit log
        await withDb((client) =>
          client.query(
            `INSERT INTO admin.audit_log (admin_id, action, details, date)
           VALUES ($1, $2, $3, NOW())`,
            [
              req.session.user.id,
              "DELETE_TENDER",
              `Deleted tender: '${tender[0].title}' (ID: ${tenderId})`,
            ],
          ),
        );

        res.json({
          message: `Tender '${tender[0].title}' deleted successfully.`,
        });
      } catch (err) {
        console.error(`Error deleting tender ${tenderId}:`, err);
        res.status(500).json({
          error: "Error deleting tender.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // POST /gis/tenders/:id/documents — Add document to tender
  router.post("/gis/tenders/:id/documents", requireAuth, async (req, res) => {
    const tenderId = parseInt(req.params.id, 10);
    if (isNaN(tenderId)) {
      return res.status(400).json({ error: "Invalid tender ID format." });
    }

    const { title, file_url, document_type, file_size, sort_order } = req.body;

    if (!title || !file_url) {
      return res
        .status(400)
        .json({ error: "Title and file URL are required." });
    }

    try {
      const docRows = await withDb((client) =>
        client.query(
          `INSERT INTO public.tender_document
           (tender_id, title, file_url, document_type, file_size, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, title, file_url`,
          [
            tenderId,
            title,
            file_url,
            document_type || "PDF",
            file_size || null,
            sort_order || 0,
          ],
        ),
      );

      // Audit log
      await withDb((client) =>
        client.query(
          `INSERT INTO admin.audit_log (admin_id, action, details, date)
           VALUES ($1, $2, $3, NOW())`,
          [
            req.session.user.id,
            "ADD_TENDER_DOCUMENT",
            `Added document '${title}' to tender ID ${tenderId}`,
          ],
        ),
      );

      res.status(201).json({
        message: "Document added successfully!",
        document: docRows[0],
      });
    } catch (err) {
      console.error(`Error adding document to tender ${tenderId}:`, err);
      res.status(500).json({
        error: "Error adding document.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/tenders/:id/documents/:docId — Remove document
  router.delete(
    "/gis/tenders/:id/documents/:docId",
    requireAuth,
    async (req, res) => {
      const tenderId = parseInt(req.params.id, 10);
      const docId = parseInt(req.params.docId, 10);

      if (isNaN(tenderId) || isNaN(docId)) {
        return res.status(400).json({ error: "Invalid ID format." });
      }

      try {
        const doc = await withDb((client) =>
          client.query(
            "SELECT id, title FROM public.tender_document WHERE id = $1 AND tender_id = $2",
            [docId, tenderId],
          ),
        );

        if (doc.length === 0) {
          return res.status(404).json({ error: "Document not found." });
        }

        await withDb((client) =>
          client.query("DELETE FROM public.tender_document WHERE id = $1", [
            docId,
          ]),
        );

        res.json({
          message: `Document '${doc[0].title}' removed successfully.`,
        });
      } catch (err) {
        console.error(`Error deleting document ${docId}:`, err);
        res.status(500).json({
          error: "Error deleting document.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // GET /gis/tenders/categories — Get distinct categories (for filters)
  router.get("/gis/tenders/categories", async (req, res) => {
    try {
      const categories = await withDb((client) =>
        client.query(
          "SELECT DISTINCT category FROM public.tender WHERE category IS NOT NULL ORDER BY category",
        ),
      );
      res.json(categories.map((c) => c.category));
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({
        error: "Error fetching categories.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  return router;
}
