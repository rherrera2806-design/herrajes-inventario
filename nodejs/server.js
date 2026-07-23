require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { engine } = require('express-handlebars');
const path = require('path');
const db = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL pool for sessions
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/herrajes_inventario',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Session middleware with PostgreSQL store
app.use(session({
    store: new pgSession({
        pool: pgPool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'herrajes-secret-2026-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Handlebars
const hbs = require('handlebars');
hbs.registerHelper('eq', (a, b) => a === b);

app.engine('handlebars', engine({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts')
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Auth middleware for API routes
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    next();
}

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));

// Protected routes (auth required)
app.use('/api/productos', requireAuth, require('./routes/productos'));
app.use('/api/productos', requireAuth, require('./routes/excel'));
app.use('/api/cotizaciones', requireAuth, require('./routes/cotizaciones'));
app.use('/api/stock', requireAuth, require('./routes/stock'));
app.use('/api/clientes', requireAuth, require('./routes/clientes'));
app.use('/api/clientes', requireAuth, require('./routes/excel'));
app.use('/api/usuarios', requireAuth, require('./routes/usuarios'));

// Protected API endpoints
app.get('/api/categorias', requireAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categorias WHERE activo = true ORDER BY nombre');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/proveedores', requireAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM proveedores WHERE activo = true ORDER BY nombre');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/usuarios', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.created_at,
                   p.telefono
            FROM users u
            LEFT JOIN perfil_usuario p ON p.user_id = u.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Protected PDF download (in-memory)
app.get('/api/cotizaciones/:id/descargar-pdf', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const cotizacion = await db.query(`
            SELECT c.*, cl.nombre as cliente_nombre, cl.rfc as cliente_rfc,
                   cl.telefono as cliente_telefono, cl.email as cliente_email,
                   cl.direccion as cliente_direccion, cl.ciudad as cliente_ciudad
            FROM cotizaciones c
            LEFT JOIN clientes cl ON cl.id = c.cliente_id
            WHERE c.id = $1
        `, [id]);

        if (cotizacion.rows.length === 0) {
            return res.status(404).json({ error: 'Cotización no encontrada' });
        }

        const detalles = await db.query(`
            SELECT cd.*, p.codigo, p.nombre as producto_nombre
            FROM cotizacion_detalles cd
            JOIN productos p ON p.id = cd.producto_id
            WHERE cd.cotizacion_id = $1
        `, [id]);

        const { generarPdfCotizacion } = require('./services/pdfService');
        const pdfBuffer = await generarPdfCotizacion(cotizacion.rows[0], detalles.rows);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cotizacion.rows[0].numero}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Protected Dashboard route
app.get('/', requireAuth, async (req, res) => {
    try {
        const stockCritico = await db.query(`
            SELECT p.codigo, p.nombre, p.stock_actual, p.stock_minimo,
                   c.nombre as categoria,
                   CASE
                       WHEN p.stock_actual = 0 THEN 'AGOTADO'
                       WHEN p.stock_actual <= p.stock_minimo THEN 'CRITICO'
                       ELSE 'OK'
                   END as estado
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.activo = true AND p.stock_actual <= p.stock_minimo
            ORDER BY p.stock_actual ASC
        `);

        const resumen = await db.query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) as agotados,
                SUM(CASE WHEN stock_actual > 0 AND stock_actual <= stock_minimo THEN 1 ELSE 0 END) as criticos,
                SUM(CASE WHEN stock_actual > stock_minimo THEN 1 ELSE 0 END) as ok
            FROM productos WHERE activo = true
        `);

        res.render('dashboard', {
            stockCritico: stockCritico.rows,
            resumen: resumen.rows[0],
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.render('dashboard', { stockCritico: [], resumen: {} });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
db.init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n========================================`);
        console.log(`  Sistema de Herrajes - Inventario`);
        console.log(`  Servidor corriendo en: http://localhost:${PORT}`);
        console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`========================================\n`);
    });
}).catch(err => {
    console.error('Error al iniciar la base de datos:', err);
    process.exit(1);
});
