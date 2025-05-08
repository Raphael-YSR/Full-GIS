// server.js (Editable - Current: Stage 1 Start)
import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false // Required for Supabase
    }
};

const pool = new pg.Pool(dbConfig);

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add body-parser for JSON // << IMPORTANT for PUT requests
app.use(express.static('public'));


// Add static middleware for admin directory
// Serve static files directly from the 'admin' directory when requested under '/admin' path
// Example: /admin/styles.css will serve admin/styles.css
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-very-secret-key-change-me', // Use environment variable
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies ONLY in production (HTTPS)
        httpOnly: true, // Prevent client-side JS access
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        sameSite: 'lax' // Recommended for CSRF protection, 'lax' is a good default
       }
}));

// --- Routes ---

// 1. Serve the main map HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// 2. Serve the login form
app.get('/login', (req, res) => {
    // If already logged in, redirect to admin
    if (req.session.user) {
       return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// 3. Handle login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).redirect('/login?error=Email%20and%20password%20required');
    }

    let client; // Declare client outside try block
    try {
        client = await pool.connect();

        const result = await client.query('SELECT * FROM admin.admin WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Ensure hashed_pass column exists and is not null
            if (!user.hashed_pass) {
                console.error(`User ${email} found but has no hashed_pass defined.`);
                return res.status(500).redirect('/login?error=Server%20configuration%20error');
            }

            const passwordMatch = await bcrypt.compare(password, user.hashed_pass);

            if (passwordMatch) {
                req.session.regenerate((err) => {
                    if (err) {
                        console.error('Session regeneration error:', err);
                        return res.status(500).redirect('/login?error=Session%20error');
                    }
                    
                    // Set user data AFTER regeneration
                    req.session.user = { id: user.role_id, email: user.email };
                    
                    // Save the session before redirecting
                    req.session.save((err) => {
                        if (err) {
                            console.error('Session save error:', err);
                            return res.status(500).redirect('/login?error=Session%20error');
                        }
                        
                        console.log(`User ${email} logged in successfully.`);
                        console.log('Session ID:', req.sessionID);
                        res.redirect('/admin');
                    });
                });
            } else {
                console.log(`Password mismatch for user ${email}`);
                return res.redirect('/login?error=Incorrect%20email%20or%20password');
            }
        } else {
            console.log(`User not found: ${email}`);
            return res.redirect('/login?error=Incorrect%20email%20or%20password');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).redirect('/login?error=Internal%20Server%20Error');
    } finally {
        if (client) {
            client.release(); // Ensure client is always released
        }
    }
});

// 4.  Middleware to protect admin routes
const requireAuth = (req, res, next) => {
    console.log('Checking authentication: '); //add console log to see session.
    if (req.session && req.session.user) {
        next();
    } else {
        console.log('Authentication required, redirecting to login.');
        res.redirect('/login');
    }
};

// 4.1 Middleware for superadmin authentication
const superAdminAuth = async (req, res, next) => {
    console.log('Checking superadmin permissions'); 
    if (req.session && req.session.user) {
        let client;
        try {
            client = await pool.connect();
            const result = await client.query('SELECT role_id FROM admin.admin WHERE role_id = $1', [req.session.user.id]);
            
            if (result.rows.length > 0 && result.rows[0].role_id === 2) {
                next();
            } else {
                // Return 403 Forbidden status for AJAX requests
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({ error: 'Superadmin privileges required' });
                }
                // Otherwise redirect with a message
                return res.redirect('/admin?error=superadmin');
            }
        } catch (err) {
            console.error('Error checking superadmin status:', err);
            return res.status(500).redirect('/admin?error=internal');
        } finally {
            if (client) client.release();
        }
    } else {
        console.log('Authentication required, redirecting to login.');
        res.redirect('/admin');
    }
};


// 5. Serve protected admin pages (protected by requireAuth middleware)

// Serve the admin landing page
app.get('/admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'administration.html'));
});

// Serve the add-data page
app.get('/add-data', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'add-data.html'));
});

// Serve the search page
app.get('/search', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'search.html'));
});

app.get('/add-admin', requireAuth, superAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'add-admin.html'));
});

// Serve the edit-data page
// NOTE: This route needs to handle specific project IDs,
// usually via query params or route params handled by client-side JS
// Serving the static file here is okay, JS will fetch the specific data.
app.get('/edit-data', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'edit-data.html'));
});


// Handle logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Error logging out');
        }
        // Redirect to home page or login page after logout
        res.redirect('/');
    });
});


// 6. API endpoint to get project locations for the main public map (does not require auth)
app.get('/api/projects/locations', async (req, res) => {
    console.log('Received request for /api/projects/locations');
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to database for project locations');
        // Ensure column names and table names match your schema EXACTLY
        const sql = `
            SELECT
                p.project_name,
                p.description,
                s.status,
                p.progress,
                c.county_name AS county,
                t.type AS project_type,
                ST_Y(p.hashed_location::geometry) AS lat, -- Ensure correct casting if needed
                ST_X(p.hashed_location::geometry) AS lng  -- Ensure correct casting if needed
            FROM public.project p 
            JOIN public.county c ON p.county_id = c.id
            JOIN public.status s ON p.project_status = s.id
            JOIN public.type t ON p.project_type = t.id
            WHERE
                p.hashed_location IS NOT NULL
                AND ST_GeometryType(p.hashed_location::geometry) = 'ST_Point';
        `;
        const result = await client.query(sql);
        console.log(`Found ${result.rows.length} projects with locations.`);
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query or connecting to DB for project locations:', err.stack);
        res.status(500).json({ error: 'Internal Server Error fetching locations', details: err.message });
    } finally {
        if (client) {
            client.release();
            console.log('Database client released for project locations');
        }
    }
});


// --- Protected API Endpoints (apply requireAuth) ---

// 7. API endpoint to add a new project
app.post('/api/projects', requireAuth, async (req, res) => { 
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

    // Basic Validation
    if (!project_name || !county_id || !project_status || !project_type || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    let client;
    try {
        const lat = Number(latitude);
        const lon = Number(longitude);

        if (isNaN(lat) || isNaN(lon)) {
          return res.status(400).json({ error: 'Invalid latitude or longitude.' });
        }

        // Ensure coordinates are within valid ranges (optional but good practice)
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Latitude or longitude out of range.' });
        }

        const hashed_location = `POINT(${lon} ${lat})`;

        client = await pool.connect();
        // Use parameterized query to prevent SQL injection
        await client.query(
          `INSERT INTO public.project (county_id, project_status, project_type, description, people_served, hashed_location, progress, project_name)
           VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326), $7, $8)`,
          [
            county_id,
            project_status,
            project_type,
            description || null, // Handle potentially missing non-required fields
            people_served || null,
            hashed_location,
            progress || null,
            project_name,
          ]
        );

        res.status(201).json({ message: `Project '${project_name}' has been added!` }); // Use 201 Created status

    } catch (err) {
      console.error('Error adding project:', err);
      // Provide more specific error messages if possible (e.g., constraint violations)
      if (err.code === '23505') { // Unique constraint violation
           return res.status(409).json({ error: 'Project name already exists.'});
      }
      res.status(500).json({ error: 'Error adding project.', details: err.message });
    } finally {
         if (client) client.release();
    }
});

// 8. 
// API route to serve County Boundaries GeoJSON
 
app.get('/api/countyBounds', async (req, res) => {
    try {
      // Query using the correct column names from the county table
      const result = await pool.query(`
        SELECT id, county_name, ST_AsGeoJSON(geom)::json AS geometry
        FROM public.county
        WHERE geom IS NOT NULL
      `);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No counties found' });
      }
  
      // Create GeoJSON with the correct column mappings
      const geojson = {
        type: "FeatureCollection",
        features: result.rows.map(row => ({
          type: "Feature",
          geometry: row.geometry,
          properties: {
            id: row.id,            
            county_name: row.county_name  
          }
        }))
      };
  
      res.json(geojson);
  
    } catch (err) {
      console.error("Query Error:", err);
      res.status(500).json({ error: err.message });
    }
  });


// 9. API endpoints to get supporting data for dropdowns (can be public or protected)
// Decide if these need requireAuth based on whether non-admins should see these lists

// Get Counties
app.get('/api/counties', async (req, res) => { // No auth needed usually
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT id, county_name FROM public.county ORDER BY county_name'); // Added ORDER BY
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching counties:', err);
        res.status(500).json({ error: 'Error fetching counties.', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// Get Statuses
app.get('/api/statuses', async (req, res) => { // No auth needed usually
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT id, status FROM public.status ORDER BY status'); // Added ORDER BY
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching statuses:', err);
        res.status(500).json({ error: 'Error fetching statuses.', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// Get Types
app.get('/api/types', async (req, res) => { // No auth needed usually
     let client;
     try {
        client = await pool.connect();
        const result = await client.query('SELECT id, type FROM public.type ORDER BY type'); // Added ORDER BY
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching types:', err);
        res.status(500).json({ error: 'Error fetching types.', details: err.message });
    } finally {
        if (client) client.release();
    }
});


// 10. Search endpoint (protected)
app.get("/api/search", requireAuth, async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: "Search query parameter 'q' is required." });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            `SELECT
                p.id, -- Return the ID for linking to edit page
                p.project_name,
                c.county_name AS county,
                p.progress,
                s.status AS status,
                p.description
            FROM public.project p
            JOIN public.county c ON p.county_id = c.id
            JOIN public.status s ON p.project_status = s.id
            WHERE p.project_name ILIKE $1 OR p.description ILIKE $1 -- Search name OR description
            ORDER BY p.project_name -- Add ordering
            LIMIT 50 -- Add a limit to prevent huge responses
            `,
            [`%${query}%`] // Use query parameter safely
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Search Database error:", err);
        res.status(500).json({ error: "Internal server error during search", details: err.message });
    } finally {
        if (client) client.release();
    }
});



// 11. API endpoint to get a SINGLE project by ID (protected)
// GET /api/project/123
app.get('/api/project/:id', requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10); // Ensure ID is an integer

    if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format.' });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT
                p.id,
                p.project_name,
                p.county_id,
                p.project_status,
                p.project_type,
                p.description,
                p.people_served,
                p.progress,
                ST_Y(p.hashed_location::geometry) AS latitude,
                ST_X(p.hashed_location::geometry) AS longitude
            FROM public.project p
            WHERE p.id = $1
        `, [projectId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Project with ID ${projectId} not found.` });
        }

        res.json(result.rows[0]); // Return the single project object
    } catch (err) {
        console.error(`Error fetching project ${projectId}:`, err);
        res.status(500).json({ error: 'Error fetching project details.', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// 12. API endpoint to update a project (protected)
// PUT /api/project/123
app.put('/api/project/:id', requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
     if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format.' });
    }

    // Destructure expected fields from req.body
    const {
        project_name, county_id, project_status, project_type,
        description, people_served, progress, latitude, longitude
    } = req.body;

     // Basic Validation
    if (!project_name || !county_id || !project_status || !project_type || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required fields for update.' });
    }

    let client;
    try {
        const lat = Number(latitude);
        const lon = Number(longitude);

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Invalid or out-of-range latitude or longitude.' });
        }

        const hashed_location = `POINT(${lon} ${lat})`;

        client = await pool.connect();
        const result = await client.query(`
            UPDATE public.project
            SET
                project_name = $1,
                county_id = $2,
                project_status = $3,
                project_type = $4,
                description = $5,
                people_served = $6,
                progress = $7,
                hashed_location = ST_GeomFromText($8, 4326)
            WHERE id = $9
            RETURNING id -- Optional: return ID to confirm which record was updated
        `, [
            project_name, county_id, project_status, project_type,
            description || null, people_served || null, progress || null,
            hashed_location, projectId
        ]);

        // Check if any row was actually updated
        if (result.rowCount === 0) {
             return res.status(404).json({ error: `Project with ID ${projectId} not found for update.` });
        }

        res.json({ message: `Project '${project_name}' (ID: ${projectId}) updated successfully!` });

    } catch (err) {
        console.error(`Error updating project ${projectId}:`, err);
         if (err.code === '23505') { // Handle unique constraint violation on update
           return res.status(409).json({ error: 'Another project with this name might already exist.'});
         }
        res.status(500).json({ error: 'Error updating project.', details: err.message });
    } finally {
        if (client) client.release();
    }
});


// 13. API endpoint to delete a project (protected)
// DELETE /api/project/123
app.delete('/api/project/:id', requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
     if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format.' });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query('DELETE FROM public.project WHERE id = $1 RETURNING project_name', [projectId]);

        // Check if a row was actually deleted
        if (result.rowCount === 0) {
            return res.status(404).json({ error: `Project with ID ${projectId} not found for deletion.` });
        }

        const deletedProjectName = result.rows[0].project_name;
        res.json({ message: `Project '${deletedProjectName}' (ID: ${projectId}) deleted successfully!` }); // Return 200 OK or 204 No Content

    } catch (err) {
        console.error(`Error deleting project ${projectId}:`, err);
        // Handle potential foreign key constraint errors if projects are linked elsewhere
        if (err.code === '23503') { // Foreign key violation
             return res.status(409).json({ error: 'Cannot delete project because it is referenced elsewhere.'});
        }
        res.status(500).json({ error: 'Error deleting project.', details: err.message });
    } finally {
         if (client) client.release();
    }
});


// 14. API TO FETCH DEPARTMENTS

app.get('/api/departments', requireAuth, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT id, department_name FROM admin.department ORDER BY department_name');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Error fetching departments.', details: err.message });
    } finally {
        if (client) client.release();
    }
});


// 15. API TO ADD ADMINS

app.post('/api/admins', requireAuth, superAdminAuth, async (req, res) => {
    const { email, password, f_name, l_name, department_id } = req.body;

    // Basic Validation
    if (!email || !password || !f_name || !l_name || !department_id) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    let client;
    try {
        client = await pool.connect();

        // Check if the email already exists
        const emailCheckResult = await client.query('SELECT id FROM admin.admin WHERE email = $1', [email]);
        if (emailCheckResult.rows.length > 0) {
            return res.status(409).json({ error: 'Email address already exists.' });
        }

        // Hash the password securely (using bcrypt is highly recommended)
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        const result = await client.query(
            `INSERT INTO admin.admin (hashed_pass, email, fname, lname, is_active, department_id, role_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, email, fname, lname, is_active, department_id, role_id`,
            [hashedPassword, email, f_name, l_name, true, department_id, 1] // role_id is always 1 for new admins
        );
        

        res.status(201).json({ message: `Administrator '${f_name} ${l_name}' has been added!`, admin: result.rows[0] });

    } catch (err) {
        console.error('Error adding administrator:', err);
        if (err.code === '23503') { // Foreign key constraint violation (department_id)
            return res.status(400).json({ error: 'Invalid department ID.' });
        }
        res.status(500).json({ error: 'Error adding administrator.', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// --- Error Handling Middleware (Basic Example) ---
// Place this after all routes
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack);
    res.status(500).send('Something broke!');
});

// --- Start Server ---
// Use an async IIFE to ensure DB connection before starting server
(async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('>>> Initial database connection successful.');
        client.release();

        app.listen(port, () => {
            console.log(`>>> Server listening at http://localhost:${port}`);
            //console.log(`>>> Admin accessible at http://localhost:${port}/admin (requires login)`);
        });

    } catch (err) {
        console.error('FATAL: Initial database connection failed:', err);
        if (client) client.release();
        process.exit(1); // Exit if DB connection fails on startup
    }
})();