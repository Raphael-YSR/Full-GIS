import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import cors from "cors";
import pgSession from "connect-pg-simple";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { pool, withDb } from "./db.js";
import createRouter from "./routes.js";
import createProjectRouter from "./projectRoutes.js";
import createAdminRouter from "./adminRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CORS ---
const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = [
      "https://full-gis.onrender.com",
      "http://localhost:3000",
    ];
    if (!origin || allowedOrigins.includes(origin)) {
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

// --- Session ---
const pgStore = pgSession(session);
app.use(
  session({
    store: new pgStore({ pool, tableName: "user_sessions" }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 2,
    },
    proxy: true,
  }),
);

// --- Rate Limiting ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
});

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

const requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect("/gis/login");
};

const superAdminAuth = (req, res, next) => {
  if (req.session?.user?.roleId === 2) return next();
  const wantsJson =
    req.xhr || (req.headers.accept && req.headers.accept.includes("json"));
  if (wantsJson)
    return res.status(403).json({ error: "Superadmin privileges required." });
  return res.redirect("/gis/admin?error=superadmin");
};

// ===========================================
// ROUTES
// ===========================================

app.use(createProjectRouter(requireAuth, superAdminAuth)); // API routes first
app.use(createAdminRouter(requireAuth, superAdminAuth));
app.use(createRouter(requireAuth, superAdminAuth));

app.get("/health", (req, res) => res.status(200).send("OK"));

// --- Login ---
app.post("/gis/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required." });

  try {
    const rows = await withDb((client) =>
      client.query(
        "SELECT id, email, hashed_pass, role_id FROM admin.admin WHERE email = $1",
        [email],
      ),
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "Incorrect email or password." });

    const user = rows[0];

    if (!user.hashed_pass) {
      console.error(`User ${email} found but has no hashed_pass defined.`);
      return res.status(500).json({ error: "Server configuration error." });
    }

    const passwordMatch = await bcrypt.compare(password, user.hashed_pass);
    if (!passwordMatch)
      return res.status(401).json({ error: "Incorrect email or password." });

    req.session.user = { id: user.id, email: user.email, roleId: user.role_id };

    withDb((client) =>
      client.query("UPDATE admin.admin SET last_login = NOW() WHERE id = $1", [
        user.id,
      ]),
    ).catch((err) => console.error("Failed to update last login:", err));

    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    const returnTo = req.session.returnTo || "/gis/admin";
    delete req.session.returnTo;
    return res.json({ success: true, redirectTo: returnTo });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// --- Logout ---
app.get("/gis/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Error logging out." });
    }
    res.redirect("/gis");
  });
});

// ===========================================
// STATIC FILES
// ===========================================
app.use(express.static(path.join(__dirname, "docs")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ===========================================
// ERROR HANDLERS (must be last)
// ===========================================

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({
    error: "An unexpected error occurred.",
    ...(isProd ? {} : { details: err.message }),
  });
});

// ===========================================
// START
// ===========================================
(async () => {
  try {
    const client = await pool.connect();
    console.log(">>> Initial database connection successful.");
    client.release();
    app.listen(port, () => console.log(`>>> Server listening on port ${port}`));
  } catch (err) {
    console.error("FATAL: Initial database connection failed:", err);
    process.exit(1);
  }
})();
