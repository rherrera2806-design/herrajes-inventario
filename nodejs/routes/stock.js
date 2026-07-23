const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/stock/movimientos - Historial de movimientos
router.get('/movimientos', async (req, res) => {
    try {
        const { producto_id, tipo, desde, hasta } = req.query;
        let query = `
            SELECT m.*, p.codigo, p.nombre as producto_nombre
            FROM movimientos_stock m
            JOIN productos p ON p.id = m.producto_id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (producto_id) {
            paramCount++;
            query += ` AND m.producto_id = $${paramCount}`;
            params.push(producto_id);
        }
        if (tipo) {
            paramCount++;
            query += ` AND m.tipo_movimiento = $${paramCount}`;
            params.push(tipo);
        }
        if (desde) {
            paramCount++;
            query += ` AND m.created_at >= $${paramCount}`;
            params.push(desde);
        }
        if (hasta) {
            paramCount++;
            query += ` AND m.created_at <= $${paramCount}`;
            params.push(hasta);
        }

        query += ' ORDER BY m.created_at DESC LIMIT 100';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/stock/entrada - Registrar entrada
router.post('/entrada', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { producto_id, cantidad, motivo, referencia, notas } = req.body;
        const usuario_id = req.session.user.id;

        // Verificar que el producto existe
        const producto = await client.query('SELECT * FROM productos WHERE id = $1', [producto_id]);
        if (producto.rows.length === 0) {
            throw new Error('Producto no encontrado');
        }

        // Insertar movimiento (el trigger actualiza el stock)
        const result = await client.query(`
            INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, usuario_id, notas)
            VALUES ($1, 'entrada', $2, $3, $4, $5, $6)
            RETURNING *
        `, [producto_id, cantidad, motivo, referencia, usuario_id, notas]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// POST /api/stock/salida - Registrar salida
router.post('/salida', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { producto_id, cantidad, motivo, referencia, notas } = req.body;
        const usuario_id = req.session.user.id;

        // Verificar stock suficiente
        const producto = await client.query('SELECT stock_actual FROM productos WHERE id = $1', [producto_id]);
        if (producto.rows.length === 0) {
            throw new Error('Producto no encontrado');
        }
        if (producto.rows[0].stock_actual < cantidad) {
            throw new Error(`Stock insuficiente. Disponible: ${producto.rows[0].stock_actual}`);
        }

        // Insertar movimiento (el trigger actualiza el stock)
        const result = await client.query(`
            INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, usuario_id, notas)
            VALUES ($1, 'salida', $2, $3, $4, $5, $6)
            RETURNING *
        `, [producto_id, cantidad, motivo, referencia, usuario_id, notas]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET /api/stock/alertas - Productos con stock crítico (para alertas)
router.get('/alertas', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                p.codigo,
                p.nombre,
                p.stock_actual,
                p.stock_minimo,
                pr.nombre as proveedor,
                pr.email as proveedor_email,
                CASE
                    WHEN p.stock_actual = 0 THEN 'SIN_STOCK'
                    WHEN p.stock_actual <= p.stock_minimo * 0.5 THEN 'CRITICO'
                    WHEN p.stock_actual <= p.stock_minimo THEN 'BAJO'
                    ELSE 'PRECAUCION'
                END as nivel_alerta,
                (p.stock_minimo - p.stock_actual) as cantidad_comprar
            FROM productos p
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
            WHERE p.activo = true AND p.stock_actual <= p.stock_minimo
            ORDER BY
                CASE
                    WHEN p.stock_actual = 0 THEN 0
                    WHEN p.stock_actual <= p.stock_minimo * 0.5 THEN 1
                    ELSE 2
                END,
                p.stock_actual ASC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stock/ranking-salidas - Top productos con más salidas
router.get('/ranking-salidas', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                p.codigo,
                p.nombre,
                c.nombre as categoria_nombre,
                SUM(m.cantidad) as total_salidas,
                COUNT(m.id) as num_movimientos,
                p.stock_actual
            FROM movimientos_stock m
            JOIN productos p ON p.id = m.producto_id
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE m.tipo_movimiento = 'salida' AND p.activo = true
            GROUP BY p.id, p.codigo, p.nombre, c.nombre, p.stock_actual
            ORDER BY total_salidas DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
