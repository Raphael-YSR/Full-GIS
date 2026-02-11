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
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static("docs"));
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  session({
    store: new pgStore({
      pool: pool,
      tableName: "session",
      schemaName: "admin",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
    },
  }),
);

// --- Auth Middleware ---
const isAuthenticated = (req, res, next) => {
  if (req.session.adminId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized. Please log in." });
  }
};

const isSuperAdmin = (req, res, next) => {
  if (req.session.adminId && req.session.role === "superadmin") {
    next();
  } else {
    res.status(403).json({ error: "Forbidden. Superadmin access required." });
  }
};

// --- PAGE ROUTES ---

// Landing Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "docs", "landing.html"));
});

// Login Page
app.get("/gis/login", (req, res) => {
  res.sendFile(path.join(__dirname, "docs", "login.html"));
});

// Map Page (Main)
app.get("/gis", (req, res) => {
  res.sendFile(path.join(__dirname, "docs", "index.html"));
});

// Add Data Page (Protected)
app.get("/add-data", (req, res) => {
  if (!req.session.adminId) return res.redirect("/gis/login");
  res.sendFile(path.join(__dirname, "docs", "add-data.html"));
});

// Edit Data Page (Protected)
app.get("/edit-data", (req, res) => {
  if (!req.session.adminId) return res.redirect("/gis/login");
  res.sendFile(path.join(__dirname, "docs", "edit-data.html"));
});

// --- GIS API ROUTES (Unified /gis prefix) ---

app.get("/gis/departments", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM admin.departments ORDER BY name ASC",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/counties", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM projects.counties ORDER BY name ASC",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/project-types", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, type_name FROM projects.project_types ORDER BY type_name ASC",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/status-options", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, status_name FROM projects.status_options ORDER BY id ASC",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/gis/projects", isAuthenticated, async (req, res) => {
  const {
    project_name,
    county_id,
    project_type,
    lat,
    lng,
    progress,
    status,
    people_served,
  } = req.body;
  try {
    const query = `
            INSERT INTO projects.project_details (project_name, county_id, project_type, lat, lng, progress, status, people_served)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `;
    const values = [
      project_name,
      county_id,
      project_type,
      lat,
      lng,
      progress,
      status,
      people_served || 0,
    ];
    const result = await pool.query(query, values);

    await pool.query(
      "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
      [req.session.adminId, "ADD_PROJECT", `Added project: ${project_name}`],
    );

    res
      .status(201)
      .json({ id: result.rows[0].id, message: "Project added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  try {
    const sql = `
            SELECT p.id, p.project_name, c.name as county, p.progress, s.status_name as status
            FROM projects.project_details p
            JOIN projects.counties c ON p.county_id = c.id
            JOIN projects.status_options s ON p.status = s.id
            WHERE p.project_name ILIKE $1
            LIMIT 10
        `;
    const result = await pool.query(sql, [`%${query}%`]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/project/:id", async (req, res) => {
  try {
    const query = `
            SELECT p.*, c.name as county_name, t.type_name as type_label, s.status_name as status_label
            FROM projects.project_details p
            JOIN projects.counties c ON p.county_id = c.id
            JOIN projects.project_types t ON p.project_type = t.id
            JOIN projects.status_options s ON p.status = s.id
            WHERE p.id = $1
        `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Project not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/gis/project/:id", isAuthenticated, async (req, res) => {
  const { lat, lng, progress, status } = req.body;
  try {
    const query = `
            UPDATE projects.project_details
            SET lat = $1, lng = $2, progress = $3, status = $4
            WHERE id = $5
        `;
    await pool.query(query, [lat, lng, progress, status, req.params.id]);

    await pool.query(
      "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
      [
        req.session.adminId,
        "UPDATE_PROJECT",
        `Updated project ID: ${req.params.id}`,
      ],
    );

    res.json({ message: "Project updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/projects/locations", async (req, res) => {
  try {
    const query = `
            SELECT p.id, p.project_name, p.lat, p.lng, p.progress, s.status_name as status, t.type_name as type
            FROM projects.project_details p
            JOIN projects.status_options s ON p.status = s.id
            JOIN projects.project_types t ON p.project_type = t.id
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/gis/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM admin.admins WHERE email = $1",
      [email],
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match)
      return res.status(401).json({ error: "Invalid email or password" });

    req.session.adminId = admin.id;
    req.session.role = admin.role;
    req.session.firstName = admin.first_name;

    res.json({
      message: "Login successful",
      role: admin.role,
      firstName: admin.first_name,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/gis/superadmin/add-admin", isSuperAdmin, async (req, res) => {
  const { first_name, last_name, email, password, department_id, role } =
    req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
            INSERT INTO admin.admins (first_name, last_name, email, password_hash, department_id, role)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `;
    const values = [
      first_name,
      last_name,
      email,
      hashedPassword,
      department_id,
      role || "admin",
    ];
    const result = await pool.query(query, values);

    await pool.query(
      "INSERT INTO admin.audit_log (admin_id, action, details, date) VALUES ($1, $2, $3, NOW())",
      [req.session.adminId, "CREATE_ADMIN", `Created admin: ${email}`],
    );

    res
      .status(201)
      .json({ id: result.rows[0].id, message: "Admin created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/gis/auth/status", (req, res) => {
  if (req.session.adminId) {
    res.json({
      isAuthenticated: true,
      role: req.session.role,
      firstName: req.session.firstName,
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.post("/gis/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

app.get("/gis/superadmin/admins", isSuperAdmin, async (req, res) => {
  try {
    const query = `
            SELECT a.id, a.first_name, a.last_name, a.email, d.name as department, a.role, a.created_at
            FROM admin.admins a
            JOIN admin.departments d ON a.department_id = d.id
            ORDER BY a.created_at DESC
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/gis/superadmin/reset-password", isSuperAdmin, async (req, res) => {
  const { adminId, newPassword } = req.body;
  const performingAdminId = req.session.adminId;
  let client;
  try {
    client = await pool.connect();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query(
      "UPDATE admin.admins SET password_hash = $1 WHERE id = $2",
      [hashedPassword, adminId],
    );

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
    res
      .status(500)
      .json({ error: "An error occurred while resetting the password" });
  } finally {
    if (client) client.release();
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).send("Something broke!");
});

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
