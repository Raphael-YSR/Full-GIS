/* ═══════════════════════════════════════════════════
   TWWDA — Vacancy API Routes
   ═══════════════════════════════════════════════════ */

import { Router } from "express";
import { withDb } from "./db.js";

const isProd = process.env.NODE_ENV === "production";

export default function createVacancyRouter(requireAuth, superAdminAuth) {
  const router = Router();

  // ============================================================
  // PUBLIC ROUTES (no auth required)
  // ============================================================

  // GET /gis/vacancies — List all vacancies (with pagination & filters)
  router.get("/gis/vacancies", async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        employment_type,
        department,
        search,
        sort = "-published_date",
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereClauses = [];
      let queryParams = [];
      let paramIndex = 1;

      if (status) {
        whereClauses.push(`v.status = $${paramIndex++}`);
        queryParams.push(status);
      }

      if (employment_type) {
        whereClauses.push(`v.employment_type = $${paramIndex++}`);
        queryParams.push(employment_type);
      }

      if (department) {
        whereClauses.push(`v.department = $${paramIndex++}`);
        queryParams.push(department);
      }

      if (search) {
        whereClauses.push(
          `(v.title ILIKE $${paramIndex++} OR v.reference_number ILIKE $${paramIndex++})`,
        );
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Get total count
      const countResult = await withDb((client) =>
        client.query(
          `SELECT COUNT(*) FROM public.vacancy v ${whereClause}`,
          queryParams.slice(0, paramIndex - 1),
        ),
      );
      const total = parseInt(countResult[0].count);

      // Order by
      let orderBy = "v.published_date DESC";
      if (sort === "published_date") orderBy = "v.published_date ASC";
      if (sort === "-published_date") orderBy = "v.published_date DESC";
      if (sort === "closing_date") orderBy = "v.closing_date ASC";
      if (sort === "-closing_date") orderBy = "v.closing_date DESC";

      // Get paginated results
      const vacancies = await withDb((client) =>
        client.query(
          `SELECT v.id, v.title, v.slug, v.reference_number, v.description,
                  v.job_grade, v.department, v.location, v.employment_type,
                  v.published_date, v.closing_date, v.status, v.view_count,
                  (SELECT COUNT(*) FROM public.vacancy_document vd WHERE vd.vacancy_id = v.id) as attachment_count
           FROM public.vacancy v
           ${whereClause}
           ORDER BY ${orderBy}
           LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
          [...queryParams.slice(0, paramIndex - 3), parseInt(limit), offset],
        ),
      );

      res.json({
        data: vacancies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error("Error fetching vacancies:", err);
      res.status(500).json({
        error: "Error fetching vacancies.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/vacancies/:id — Get single vacancy with documents and paragraphs
  router.get("/gis/vacancies/:id", async (req, res) => {
    const vacancyId = parseInt(req.params.id, 10);
    if (isNaN(vacancyId)) {
      return res.status(400).json({ error: "Invalid vacancy ID format." });
    }

    try {
      // Increment view count
      await withDb((client) =>
        client.query(
          "UPDATE public.vacancy SET view_count = view_count + 1 WHERE id = $1",
          [vacancyId],
        ),
      );

      // Get vacancy details
      const vacancyRows = await withDb((client) =>
        client.query(
          `SELECT v.id, v.title, v.slug, v.reference_number, v.description,
                  v.job_grade, v.department, v.location, v.employment_type,
                  v.requirements, v.responsibilities, v.salary_range,
                  v.published_date, v.closing_date, v.status, v.view_count,
                  v.created_at, v.updated_at,
                  a.fname || ' ' || a.lname as created_by_name
           FROM public.vacancy v
           LEFT JOIN admin.admin a ON v.created_by = a.id
           WHERE v.id = $1`,
          [vacancyId],
        ),
      );

      if (vacancyRows.length === 0) {
        return res.status(404).json({ error: "Vacancy not found." });
      }

      const vacancy = vacancyRows[0];

      // Get documents
      const documents = await withDb((client) =>
        client.query(
          `SELECT id, title, file_url, document_type, file_size, sort_order
           FROM public.vacancy_document
           WHERE vacancy_id = $1
           ORDER BY sort_order ASC`,
          [vacancyId],
        ),
      );

      // Get paragraphs (rich content - requirements, responsibilities, etc.)
      const paragraphs = await withDb((client) =>
        client.query(
          `SELECT id, block_type, content, sort_order
           FROM public.vacancy_paragraph
           WHERE vacancy_id = $1
           ORDER BY sort_order ASC`,
          [vacancyId],
        ),
      );

      res.json({
        ...vacancy,
        documents,
        paragraphs,
      });
    } catch (err) {
      console.error(`Error fetching vacancy ${vacancyId}:`, err);
      res.status(500).json({
        error: "Error fetching vacancy details.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // GET /gis/vacancies/:id/documents — Get only documents
  router.get("/gis/vacancies/:id/documents", async (req, res) => {
    const vacancyId = parseInt(req.params.id, 10);
    if (isNaN(vacancyId)) {
      return res.status(400).json({ error: "Invalid vacancy ID format." });
    }

    try {
      const documents = await withDb((client) =>
        client.query(
          `SELECT id, title, file_url, document_type, file_size
           FROM public.vacancy_document
           WHERE vacancy_id = $1
           ORDER BY sort_order ASC`,
          [vacancyId],
        ),
      );

      res.json(documents);
    } catch (err) {
      console.error(`Error fetching documents for vacancy ${vacancyId}:`, err);
      res.status(500).json({
        error: "Error fetching documents.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // ============================================================
  // PROTECTED ROUTES (require auth)
  // ============================================================

  // POST /gis/vacancies — Create new vacancy
  router.post("/gis/vacancies", requireAuth, async (req, res) => {
    const {
      title,
      slug,
      reference_number,
      description,
      job_grade,
      department,
      location,
      employment_type,
      requirements,
      responsibilities,
      salary_range,
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
        client.query("SELECT id FROM public.vacancy WHERE slug = $1", [slug]),
      );

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "A vacancy with this slug already exists." });
      }

      // Insert vacancy
      const vacancyRows = await withDb((client) =>
        client.query(
          `INSERT INTO public.vacancy
           (title, slug, reference_number, description, job_grade,
            department, location, employment_type, requirements,
            responsibilities, salary_range, published_date, closing_date,
            status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id, title, slug, reference_number`,
          [
            title,
            slug,
            reference_number || null,
            description || null,
            job_grade || null,
            department || null,
            location || null,
            employment_type || null,
            requirements || null,
            responsibilities || null,
            salary_range || null,
            published_date || new Date().toISOString().split("T")[0],
            closing_date || null,
            status || "open",
            req.session.user.id,
          ],
        ),
      );

      const newVacancyId = vacancyRows[0].id;

      // Insert documents
      if (documents && Array.isArray(documents) && documents.length > 0) {
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (doc.title && doc.file_url) {
            await withDb((client) =>
              client.query(
                `INSERT INTO public.vacancy_document
                 (vacancy_id, title, file_url, document_type, file_size, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  newVacancyId,
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
            ["paragraph", "requirement", "responsibility", "image"].includes(
              para.block_type,
            )
          ) {
            await withDb((client) =>
              client.query(
                `INSERT INTO public.vacancy_paragraph
                 (vacancy_id, block_type, content, sort_order)
                 VALUES ($1, $2, $3, $4)`,
                [
                  newVacancyId,
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
            "ADD_VACANCY",
            `Added vacancy: '${title}' (Ref: ${reference_number || slug})`,
          ],
        ),
      );

      res.status(201).json({
        message: `Vacancy '${title}' has been added successfully!`,
        id: newVacancyId,
        vacancy: vacancyRows[0],
      });
    } catch (err) {
      console.error("Error adding vacancy:", err);
      res.status(500).json({
        error: "Error adding vacancy.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // PUT /gis/vacancies/:id — Update vacancy
  router.put("/gis/vacancies/:id", requireAuth, async (req, res) => {
    const vacancyId = parseInt(req.params.id, 10);
    if (isNaN(vacancyId)) {
      return res.status(400).json({ error: "Invalid vacancy ID format." });
    }

    const {
      title,
      slug,
      reference_number,
      description,
      job_grade,
      department,
      location,
      employment_type,
      requirements,
      responsibilities,
      salary_range,
      published_date,
      closing_date,
      status,
    } = req.body;

    try {
      // Check if vacancy exists
      const existingVacancy = await withDb((client) =>
        client.query("SELECT id, title FROM public.vacancy WHERE id = $1", [
          vacancyId,
        ]),
      );

      if (existingVacancy.length === 0) {
        return res.status(404).json({ error: "Vacancy not found." });
      }

      // Check slug uniqueness (excluding current vacancy)
      if (slug) {
        const slugExists = await withDb((client) =>
          client.query(
            "SELECT id FROM public.vacancy WHERE slug = $1 AND id != $2",
            [slug, vacancyId],
          ),
        );
        if (slugExists.length > 0) {
          return res
            .status(409)
            .json({ error: "Another vacancy already uses this slug." });
        }
      }

      // Update vacancy
      await withDb((client) =>
        client.query(
          `UPDATE public.vacancy
           SET title = COALESCE($1, title),
               slug = COALESCE($2, slug),
               reference_number = COALESCE($3, reference_number),
               description = COALESCE($4, description),
               job_grade = COALESCE($5, job_grade),
               department = COALESCE($6, department),
               location = COALESCE($7, location),
               employment_type = COALESCE($8, employment_type),
               requirements = COALESCE($9, requirements),
               responsibilities = COALESCE($10, responsibilities),
               salary_range = COALESCE($11, salary_range),
               published_date = COALESCE($12, published_date),
               closing_date = COALESCE($13, closing_date),
               status = COALESCE($14, status)
           WHERE id = $15`,
          [
            title,
            slug,
            reference_number,
            description,
            job_grade,
            department,
            location,
            employment_type,
            requirements,
            responsibilities,
            salary_range,
            published_date,
            closing_date,
            status,
            vacancyId,
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
            "UPDATE_VACANCY",
            `Updated vacancy: '${existingVacancy[0].title}' (ID: ${vacancyId})`,
          ],
        ),
      );

      res.json({ message: "Vacancy updated successfully!" });
    } catch (err) {
      console.error(`Error updating vacancy ${vacancyId}:`, err);
      res.status(500).json({
        error: "Error updating vacancy.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/vacancies/:id — Delete vacancy (superadmin only)
  router.delete(
    "/gis/vacancies/:id",
    requireAuth,
    superAdminAuth,
    async (req, res) => {
      const vacancyId = parseInt(req.params.id, 10);
      if (isNaN(vacancyId)) {
        return res.status(400).json({ error: "Invalid vacancy ID format." });
      }

      try {
        const vacancy = await withDb((client) =>
          client.query("SELECT id, title FROM public.vacancy WHERE id = $1", [
            vacancyId,
          ]),
        );

        if (vacancy.length === 0) {
          return res.status(404).json({ error: "Vacancy not found." });
        }

        await withDb((client) =>
          client.query("DELETE FROM public.vacancy WHERE id = $1", [vacancyId]),
        );

        // Audit log
        await withDb((client) =>
          client.query(
            `INSERT INTO admin.audit_log (admin_id, action, details, date)
           VALUES ($1, $2, $3, NOW())`,
            [
              req.session.user.id,
              "DELETE_VACANCY",
              `Deleted vacancy: '${vacancy[0].title}' (ID: ${vacancyId})`,
            ],
          ),
        );

        res.json({
          message: `Vacancy '${vacancy[0].title}' deleted successfully.`,
        });
      } catch (err) {
        console.error(`Error deleting vacancy ${vacancyId}:`, err);
        res.status(500).json({
          error: "Error deleting vacancy.",
          ...(isProd ? {} : { details: err.message }),
        });
      }
    },
  );

  // POST /gis/vacancies/:id/documents — Add document to vacancy
  router.post("/gis/vacancies/:id/documents", requireAuth, async (req, res) => {
    const vacancyId = parseInt(req.params.id, 10);
    if (isNaN(vacancyId)) {
      return res.status(400).json({ error: "Invalid vacancy ID format." });
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
          `INSERT INTO public.vacancy_document
           (vacancy_id, title, file_url, document_type, file_size, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, title, file_url`,
          [
            vacancyId,
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
            "ADD_VACANCY_DOCUMENT",
            `Added document '${title}' to vacancy ID ${vacancyId}`,
          ],
        ),
      );

      res.status(201).json({
        message: "Document added successfully!",
        document: docRows[0],
      });
    } catch (err) {
      console.error(`Error adding document to vacancy ${vacancyId}:`, err);
      res.status(500).json({
        error: "Error adding document.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  // DELETE /gis/vacancies/:id/documents/:docId — Remove document
  router.delete(
    "/gis/vacancies/:id/documents/:docId",
    requireAuth,
    async (req, res) => {
      const vacancyId = parseInt(req.params.id, 10);
      const docId = parseInt(req.params.docId, 10);

      if (isNaN(vacancyId) || isNaN(docId)) {
        return res.status(400).json({ error: "Invalid ID format." });
      }

      try {
        const doc = await withDb((client) =>
          client.query(
            "SELECT id, title FROM public.vacancy_document WHERE id = $1 AND vacancy_id = $2",
            [docId, vacancyId],
          ),
        );

        if (doc.length === 0) {
          return res.status(404).json({ error: "Document not found." });
        }

        await withDb((client) =>
          client.query("DELETE FROM public.vacancy_document WHERE id = $1", [
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

  // GET /gis/vacancies/filters — Get filter options
  router.get("/gis/vacancies/filters", async (req, res) => {
    try {
      const [statuses, employmentTypes, departments] = await Promise.all([
        withDb((client) =>
          client.query(
            "SELECT DISTINCT status FROM public.vacancy WHERE status IS NOT NULL ORDER BY status",
          ),
        ),
        withDb((client) =>
          client.query(
            "SELECT DISTINCT employment_type FROM public.vacancy WHERE employment_type IS NOT NULL ORDER BY employment_type",
          ),
        ),
        withDb((client) =>
          client.query(
            "SELECT DISTINCT department FROM public.vacancy WHERE department IS NOT NULL ORDER BY department",
          ),
        ),
      ]);

      res.json({
        statuses: statuses.map((s) => s.status),
        employment_types: employmentTypes.map((e) => e.employment_type),
        departments: departments.map((d) => d.department),
      });
    } catch (err) {
      console.error("Error fetching filter options:", err);
      res.status(500).json({
        error: "Error fetching filter options.",
        ...(isProd ? {} : { details: err.message }),
      });
    }
  });

  return router;
}
