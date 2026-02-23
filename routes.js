/* ═══════════════════════════════════════════════════
   TWWDA — Page Routes
   Exported as a factory function so server.js can
   pass in requireAuth and superAdminAuth middleware.
   ═══════════════════════════════════════════════════ */

import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path helpers
const docs = (file) => path.join(__dirname, "docs", file);
const pub = (file) => path.join(__dirname, "docs", "public", file);
const adm = (file) => path.join(__dirname, "admin", file);

export default function createRouter(requireAuth, superAdminAuth) {
  const router = Router();

  /* ════════════════════════════════════
     PUBLIC PAGES — No auth required
     ════════════════════════════════════ */

  // Landing
  router.get("/", (req, res) => res.sendFile(docs("landing.html")));

  // ── About Us ──────────────────────────────────────────
  router.get("/about-us", (req, res) => res.sendFile(pub("about-us.html")));
  router.get("/background", (req, res) => res.sendFile(pub("background.html")));
  router.get("/vision-mission", (req, res) =>
    res.sendFile(pub("vision-mission.html")),
  );
  router.get("/mandate", (req, res) => res.sendFile(pub("mandate.html")));
  router.get("/board-of-directors", (req, res) =>
    res.sendFile(pub("board-of-directors.html")),
  );
  router.get("/management", (req, res) => res.sendFile(pub("management.html")));
  router.get("/organogram", (req, res) => res.sendFile(pub("organogram.html")));
  router.get("/strategic-plan", (req, res) =>
    res.sendFile(pub("strategic-plan.html")),
  );
  router.get("/service-charter", (req, res) =>
    res.sendFile(pub("service-charter.html")),
  );
  router.get("/quality-policy", (req, res) =>
    res.sendFile(pub("quality-policy.html")),
  );

  // ── Projects ───────────────────────────────────────────
  router.get("/projects", (req, res) => res.sendFile(pub("projects.html")));
  router.get("/projects/embu", (req, res) =>
    res.sendFile(pub("projects-embu.html")),
  );
  router.get("/projects/kirinyaga", (req, res) =>
    res.sendFile(pub("projects-kirinyaga.html")),
  );
  router.get("/projects/meru", (req, res) =>
    res.sendFile(pub("projects-meru.html")),
  );
  router.get("/projects/nyeri", (req, res) =>
    res.sendFile(pub("projects-nyeri.html")),
  );
  router.get("/projects/tharaka", (req, res) =>
    res.sendFile(pub("projects-tharaka.html")),
  );
  router.get("/projects/garissa", (req, res) =>
    res.sendFile(pub("projects-garissa.html")),
  );
  router.get("/projects/isiolo", (req, res) =>
    res.sendFile(pub("projects-isiolo.html")),
  );
  router.get("/projects/mandera", (req, res) =>
    res.sendFile(pub("projects-mandera.html")),
  );
  router.get("/projects/marsabit", (req, res) =>
    res.sendFile(pub("projects-marsabit.html")),
  );
  router.get("/projects/muranga", (req, res) =>
    res.sendFile(pub("projects-muranga.html")),
  );

  // ── Media Center ───────────────────────────────────────
  router.get("/news", (req, res) => res.sendFile(pub("news.html")));
  router.get("/speeches", (req, res) => res.sendFile(pub("speeches.html")));
  router.get("/publications", (req, res) =>
    res.sendFile(pub("publications.html")),
  );
  router.get("/access-to-information", (req, res) =>
    res.sendFile(pub("access-to-information.html")),
  );
  router.get("/events", (req, res) => res.sendFile(pub("events.html")));
  router.get("/photo-gallery", (req, res) =>
    res.sendFile(pub("photo-gallery.html")),
  );
  router.get("/video-gallery", (req, res) =>
    res.sendFile(pub("video-gallery.html")),
  );
  router.get("/downloads", (req, res) => res.sendFile(pub("downloads.html")));

  // ── Standalone nav links ────────────────────────────────
  router.get("/tenders", (req, res) => res.sendFile(pub("tenders.html")));
  router.get("/contact-us", (req, res) => res.sendFile(pub("contact-us.html")));
  router.get("/working-with-us", (req, res) =>
    res.sendFile(pub("working-with-us.html")),
  );
  router.get("/corruption", (req, res) => res.sendFile(pub("corruption.html")));

  /* ════════════════════════════════════
     GIS PUBLIC PAGES
     ════════════════════════════════════ */

  router.get("/gis", (req, res) => res.sendFile(docs("index.html")));
  router.get("/gis/login", (req, res) => res.sendFile(docs("login.html")));

  /* ════════════════════════════════════
     PROTECTED GIS ADMIN PAGES
     Auth middleware injected from server.js
     ════════════════════════════════════ */

  router.get("/gis/admin", requireAuth, (req, res) =>
    res.sendFile(adm("administration.html")),
  );
  router.get("/gis/add-data", requireAuth, (req, res) =>
    res.sendFile(adm("add-data.html")),
  );
  router.get("/gis/search", requireAuth, (req, res) =>
    res.sendFile(adm("search.html")),
  );
  router.get("/gis/edit-data", requireAuth, (req, res) =>
    res.sendFile(adm("edit-data.html")),
  );
  router.get("/gis/superadmin", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("superadministrator.html")),
  );
  router.get("/gis/add-admin", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("add-admin.html")),
  );
  router.get("/gis/search-delete", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("search-delete.html")),
  );
  router.get("/gis/delete-project", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("delete-project.html")),
  );
  router.get("/gis/search-admin", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("search-admin.html")),
  );
  router.get("/gis/delete-admin", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("delete-admin.html")),
  );
  router.get("/gis/reset-search", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("reset-search.html")),
  );
  router.get("/gis/reset-password", requireAuth, superAdminAuth, (req, res) =>
    res.sendFile(adm("reset-password.html")),
  );

  return router;
}
