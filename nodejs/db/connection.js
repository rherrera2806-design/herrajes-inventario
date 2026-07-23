const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Use DATABASE_URL for Supabase/production, fallback to local PostgreSQL
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/herrajes_inventario';

const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('Conectado a PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Error en la conexión a la BD:', err);
});

const api = {
    _ready: false,
    _initPromise: null,

    async init() {
        if (this._ready) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                // Test connection
                await pool.query('SELECT 1');
                console.log('PostgreSQL conectado');

                // Auto-create schema if tables don't exist
                await this._initSchema();
                await this._seedData();

                this._ready = true;
            } catch (err) {
                console.error('Error al conectar a PostgreSQL:', err.message);
                throw err;
            }
        })();

        return this._initPromise;
    },

    async _initSchema() {
        const client = await pool.connect();
        try {
            // Check if all critical tables exist
            const tableCheck = await client.query(`
                SELECT
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') as has_users,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') as has_productos,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clientes') as has_clientes,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cotizaciones') as has_cotizaciones,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimientos_stock') as has_movimientos
            `);

            const t = tableCheck.rows[0];
            if (t.has_users && t.has_productos && t.has_clientes && t.has_cotizaciones && t.has_movimientos) {
                console.log('Esquema completo, saltando inicialización');
                return;
            }

            console.log('Creando esquema...');

            // Read and execute schema SQL
            const fs = require('fs');
            const path = require('path');
            const schemaPath = path.join(__dirname, '..', 'sql', '04_schema_local.sql');

            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                await client.query(schema);
                console.log('Esquema creado desde 04_schema_local.sql');
            } else {
                // Inline schema creation
                await client.query(`
                    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        nombre TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        rol TEXT NOT NULL DEFAULT 'consulta'
                            CHECK (rol IN ('admin','ventas','bodega','compras','consulta')),
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS categorias (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        nombre TEXT NOT NULL UNIQUE,
                        descripcion TEXT,
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS proveedores (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        nombre TEXT NOT NULL,
                        contacto TEXT,
                        telefono TEXT,
                        email TEXT,
                        direccion TEXT,
                        rfc TEXT,
                        costo_referencia DECIMAL(12,2),
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS productos (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        codigo TEXT NOT NULL UNIQUE,
                        nombre TEXT NOT NULL,
                        descripcion TEXT,
                        unidad_medida TEXT NOT NULL DEFAULT 'pieza',
                        categoria_id UUID NOT NULL REFERENCES categorias(id),
                        proveedor_id UUID REFERENCES proveedores(id),
                        precio_venta DECIMAL(12,2) NOT NULL,
                        costo_compra DECIMAL(12,2),
                        stock_actual INTEGER NOT NULL DEFAULT 0,
                        stock_minimo INTEGER NOT NULL DEFAULT 10,
                        stock_maximo INTEGER DEFAULT 500,
                        ubicacion TEXT,
                        imagen_url TEXT,
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS movimientos_stock (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        producto_id UUID NOT NULL REFERENCES productos(id),
                        tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida')),
                        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
                        motivo TEXT NOT NULL,
                        referencia TEXT,
                        usuario_id UUID REFERENCES users(id),
                        notas TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS clientes (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        nombre TEXT NOT NULL,
                        rfc TEXT,
                        telefono TEXT,
                        email TEXT,
                        direccion TEXT,
                        ciudad TEXT,
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS cotizaciones (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        numero TEXT NOT NULL UNIQUE,
                        cliente_id UUID NOT NULL REFERENCES clientes(id),
                        usuario_id UUID NOT NULL REFERENCES users(id),
                        fecha_cotizacion DATE NOT NULL DEFAULT CURRENT_DATE,
                        fecha_vigencia DATE NOT NULL,
                        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                        iva DECIMAL(12,2) NOT NULL DEFAULT 0,
                        total DECIMAL(12,2) NOT NULL DEFAULT 0,
                        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
                        descuento_monto DECIMAL(12,2) DEFAULT 0,
                        notas TEXT,
                        estado TEXT NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','enviada','aprobada','rechazada','vencida')),
                        pdf_url TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS cotizacion_detalles (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
                        producto_id UUID NOT NULL REFERENCES productos(id),
                        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
                        precio_unitario DECIMAL(12,2) NOT NULL,
                        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
                        subtotal_linea DECIMAL(12,2) NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS perfil_usuario (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                        nombre_completo TEXT NOT NULL,
                        rol TEXT NOT NULL DEFAULT 'bodega'
                            CHECK (rol IN ('admin','ventas','bodega','compras','consulta')),
                        telefono TEXT,
                        activo BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );

                    CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
                    CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id);
                    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
                    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_stock(producto_id);
                    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_stock(created_at);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones(cliente_id);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
                    CREATE INDEX IF NOT EXISTS idx_cotizacion_detalles_cotizacion ON cotizacion_detalles(cotizacion_id);
                `);
                console.log('Esquema creado inline');
            }

            // Create triggers
            await client.query(`
                CREATE OR REPLACE FUNCTION fn_actualizar_stock()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF NEW.tipo_movimiento = 'entrada' THEN
                        UPDATE productos SET stock_actual = stock_actual + NEW.cantidad, updated_at = NOW() WHERE id = NEW.producto_id;
                    ELSIF NEW.tipo_movimiento = 'salida' THEN
                        IF (SELECT stock_actual FROM productos WHERE id = NEW.producto_id) < NEW.cantidad THEN
                            RAISE EXCEPTION 'Stock insuficiente';
                        END IF;
                        UPDATE productos SET stock_actual = stock_actual - NEW.cantidad, updated_at = NOW() WHERE id = NEW.producto_id;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_actualizar_stock ON movimientos_stock;
                CREATE TRIGGER trg_actualizar_stock AFTER INSERT ON movimientos_stock FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock();

                CREATE OR REPLACE FUNCTION fn_calcular_totales_cotizacion()
                RETURNS TRIGGER AS $$
                DECLARE
                    v_subtotal DECIMAL(12,2);
                    v_descuento_pct DECIMAL(5,2);
                    v_descuento_monto DECIMAL(12,2);
                    v_iva DECIMAL(12,2);
                    v_total DECIMAL(12,2);
                    v_cotizacion_id UUID;
                BEGIN
                    IF TG_OP = 'DELETE' THEN v_cotizacion_id := OLD.cotizacion_id; ELSE v_cotizacion_id := NEW.cotizacion_id; END IF;
                    SELECT COALESCE(SUM(subtotal_linea), 0) INTO v_subtotal FROM cotizacion_detalles WHERE cotizacion_id = v_cotizacion_id;
                    SELECT descuento_porcentaje INTO v_descuento_pct FROM cotizaciones WHERE id = v_cotizacion_id;
                    v_descuento_monto := v_subtotal * (v_descuento_pct / 100);
                    v_iva := (v_subtotal - v_descuento_monto) * 0.16;
                    v_total := (v_subtotal - v_descuento_monto) + v_iva;
                    UPDATE cotizaciones SET subtotal = v_subtotal, descuento_monto = v_descuento_monto, iva = v_iva, total = v_total, updated_at = NOW() WHERE id = v_cotizacion_id;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_calcular_totales_cotizacion ON cotizacion_detalles;
                CREATE TRIGGER trg_calcular_totales_cotizacion AFTER INSERT OR UPDATE OR DELETE ON cotizacion_detalles FOR EACH ROW EXECUTE FUNCTION fn_calcular_totales_cotizacion();

                CREATE OR REPLACE FUNCTION fn_generar_numero_cotizacion()
                RETURNS TRIGGER AS $$
                DECLARE
                    v_siguiente INTEGER;
                BEGIN
                    SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 11 FOR 5) AS INTEGER)), 0) + 1 INTO v_siguiente FROM cotizaciones WHERE numero LIKE 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';
                    NEW.numero := 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_siguiente::TEXT, 5, '0');
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_generar_numero_cotizacion ON cotizaciones;
                CREATE TRIGGER trg_generar_numero_cotizacion BEFORE INSERT ON cotizaciones FOR EACH ROW WHEN (NEW.numero IS NULL OR NEW.numero = '') EXECUTE FUNCTION fn_generar_numero_cotizacion();
            `);
            console.log('Triggers creados');

        } finally {
            client.release();
        }
    },

    async _seedData() {
        const client = await pool.connect();
        try {
            const catCount = await client.query('SELECT COUNT(*) as c FROM categorias');
            if (parseInt(catCount.rows[0].c) > 0) {
                console.log('Datos ya existen, saltando seed');
                return;
            }

            console.log('Insertando datos de prueba...');

            const salt = bcrypt.genSaltSync(10);

            // Users
            const users = [
                { nombre: 'Admin Sistema', email: 'admin@herrajes.local', hash: bcrypt.hashSync('admin123', salt), rol: 'admin' },
                { nombre: 'Ventas Ejecutivo', email: 'ventas@herrajes.local', hash: bcrypt.hashSync('ventas123', salt), rol: 'ventas' },
                { nombre: 'Bodega Almacén', email: 'bodega@herrajes.local', hash: bcrypt.hashSync('bodega123', salt), rol: 'bodega' },
                { nombre: 'Compras Proveedor', email: 'compras@herrajes.local', hash: bcrypt.hashSync('compras123', salt), rol: 'compras' },
                { nombre: 'Consulta Reportes', email: 'consulta@herrajes.local', hash: bcrypt.hashSync('consulta123', salt), rol: 'consulta' },
            ];
            const userIds = [];
            for (const u of users) {
                const result = await client.query('INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id', [u.nombre, u.email, u.hash, u.rol]);
                userIds.push(result.rows[0].id);
            }

            // Perfiles
            const perfiles = [
                { uid: userIds[0], n: 'Admin Sistema', r: 'admin', t: '81-1000-0001' },
                { uid: userIds[1], n: 'Ventas Ejecutivo', r: 'ventas', t: '81-1000-0002' },
                { uid: userIds[2], n: 'Bodega Almacén', r: 'bodega', t: '81-1000-0003' },
                { uid: userIds[3], n: 'Compras Proveedor', r: 'compras', t: '81-1000-0004' },
                { uid: userIds[4], n: 'Consulta Reportes', r: 'consulta', t: '81-1000-0005' },
            ];
            for (const p of perfiles) {
                await client.query('INSERT INTO perfil_usuario (user_id, nombre_completo, rol, telefono) VALUES ($1, $2, $3, $4)', [p.uid, p.n, p.r, p.t]);
            }

            // Categories
            const cats = [
                ['Bisagras', 'Bisagras para puertas de vidrio templado'],
                ['Tornillos', 'Tornillos de acero inoxidable y zinc'],
                ['Correderas', 'Correderas para puertas corredizas'],
                ['Juntas y Sellos', 'Juntas de goma y sellos para vidrio'],
                ['Cierres', 'Cierres magnéticos y mecánicos'],
                ['Perillas y Manijas', 'Perillas, manijas y pomos decorativos'],
                ['Rieles', 'Rieles de aluminio y acero inoxidable'],
                ['Herramientas', 'Herramientas para instalación de vidrio'],
            ];
            const catIds = [];
            for (const [n, d] of cats) {
                const r = await client.query('INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING id', [n, d]);
                catIds.push(r.rows[0].id);
            }

            // Suppliers
            const provs = [
                ['Aceros del Norte', 'Juan Pérez', '81-1234-5678', 'ventas@acerosnorte.com', 'ADN950101AB3', 45000],
                ['Vidrios y Accesorios SA', 'María López', '81-2345-6789', 'contacto@vidriosacc.com', 'VYA080515QR2', 82000],
                ['Herrajes Industriales', 'Carlos Ruiz', '81-3456-7890', 'pedidos@herrajesind.com', 'HIN030320TY4', 125000],
                ['Distribuidora de Vidrio', 'Ana García', '81-4567-7890', 'ventas@distvidrio.com', 'DVI120610ML5', 67000],
                ['Ferretera Industrial', 'Roberto Sánchez', '81-5678-9012', 'info@ferreterai.com', 'FEI070901BN8', 34000],
            ];
            const provIds = [];
            for (const [n, c, t, e, r, cr] of provs) {
                const result = await client.query('INSERT INTO proveedores (nombre, contacto, telefono, email, rfc, costo_referencia) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [n, c, t, e, r, cr]);
                provIds.push(result.rows[0].id);
            }

            // Products
            const prods = [
                ['BIS-001', 'Bisagra T para puerta 10mm', 'Bisagra T acero inoxidable vidrio 10mm', catIds[0], provIds[0], 85, 42.50, 150, 30, 500, 'Estante A-1'],
                ['BIS-002', 'Bisagra para puerta 12mm', 'Bisagra plana acero cromado vidrio 12mm', catIds[0], provIds[0], 95, 48, 8, 20, 400, 'Estante A-2'],
                ['TOR-001', 'Tornillo hexagonal M8x30', 'Tornillo acero inoxidable M8 x 30mm', catIds[1], provIds[4], 3.50, 1.20, 2000, 500, 5000, 'Cajón B-1'],
                ['TOR-002', 'Tornillo autorroscante #10x1"', 'Tornillo zinc para perfilería', catIds[1], provIds[4], 2.80, 0.90, 45, 200, 5000, 'Cajón B-2'],
                ['COR-001', 'Corredera inferior 120cm', 'Corredera rodillos puerta corrediza', catIds[2], provIds[1], 320, 165, 25, 10, 100, 'Estante C-1'],
                ['COR-002', 'Corredera superior 120cm', 'Riel superior puerta corrediza', catIds[2], provIds[1], 280, 140, 3, 8, 100, 'Estante C-2'],
                ['JUN-001', 'Junta T de neopreno 10mm', 'Junta T unión vidrios', catIds[3], provIds[3], 25, 8.50, 300, 100, 1000, 'Estante D-1'],
                ['CIE-001', 'Cierre magnético 180kg', 'Cierre magnético puertas vidrio', catIds[4], provIds[2], 450, 225, 12, 5, 50, 'Estante E-1'],
                ['PER-001', 'Perilla cristal 30mm', 'Perilla cristal esmerilado puerta', catIds[5], provIds[1], 120, 55, 60, 15, 200, 'Estante F-1'],
                ['RIE-001', 'Riel aluminio 3m', 'Riel aluminio anodizado ducha', catIds[6], provIds[2], 180, 90, 2, 10, 80, 'Estante G-1'],
            ];
            const prodIds = [];
            for (const [cod, nom, desc, cat, prov, pv, cc, sa, sm, smx, ub] of prods) {
                const r = await client.query('INSERT INTO productos (codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id, precio_venta, costo_compra, stock_actual, stock_minimo, stock_maximo, ubicacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [cod, nom, desc, 'pieza', cat, prov, pv, cc, sa, sm, smx, ub]);
                prodIds.push(r.rows[0].id);
            }

            // Clients
            const clis = [
                ['Vidriería El Claro', 'VEC980101AB1', '81-1111-2222', 'contacto@elclaro.com', 'Av. Constitución 1500', 'Monterrey'],
                ['Constructora Edifica', 'CE050505CD3', '81-3333-4444', 'compras@edifica.com', 'Blvd. Díaz Ordaz 2000', 'Guadalupe'],
                ['Mueblería Moderna', 'MM100101EF5', '81-5555-6666', 'ventas@muebleriamoderna.com', 'Calle Morelos 800', 'San Nicolás'],
                ['Distribuidora Cristal', 'DC070707GH7', '81-7777-8888', 'pedidos@cristaldist.com', 'Av. Garza Sada 3000', 'Monterrey'],
                ['Ingeniería en Acero', 'IEA121212IJ9', '81-9999-0000', 'info@ingenieriaacero.com', 'Calle Madero 500', 'Apodaca'],
            ];
            for (const [n, r, t, e, d, c] of clis) {
                await client.query('INSERT INTO clientes (nombre, rfc, telefono, email, direccion, ciudad) VALUES ($1,$2,$3,$4,$5,$6)', [n, r, t, e, d, c]);
            }

            // Stock movements
            await client.query("INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES ($1,'entrada',100,'Compra a proveedor','OC-2026-001','Pedido semanal')", [prodIds[0]]);
            await client.query("INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES ($1,'salida',15,'Venta','VTA-2026-010','Proyecto vidriería')", [prodIds[0]]);
            await client.query("INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES ($1,'salida',12,'Venta','VTA-2026-011','Dejó stock bajo')", [prodIds[1]]);
            await client.query("INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES ($1,'entrada',1500,'Compra mayoreo','OC-2026-002','')", [prodIds[2]]);
            await client.query("INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, notas) VALUES ($1,'salida',5,'Venta','VTA-2026-012','Proyecto oficinas')", [prodIds[4]]);

            console.log('Datos de prueba insertados');
        } finally {
            client.release();
        }
    },

    async query(text, params) {
        if (!this._ready) {
            await this.init();
        }
        return pool.query(text, params);
    },

    async getClient() {
        return pool.connect();
    },

    get pool() { return pool; }
};

module.exports = api;
