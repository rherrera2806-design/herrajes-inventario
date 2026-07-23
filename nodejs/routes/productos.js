const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/productos - Listar todos
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.nombre as categoria_nombre, pr.nombre as proveedor_nombre
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
            WHERE p.activo = true
            ORDER BY p.nombre
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/productos/criticos - Stock crítico
router.get('/criticos', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.nombre as categoria_nombre, pr.nombre as proveedor_nombre,
                   CASE
                       WHEN p.stock_actual = 0 THEN 'AGOTADO'
                       WHEN p.stock_actual <= p.stock_minimo * 0.5 THEN 'CRITICO'
                       WHEN p.stock_actual <= p.stock_minimo THEN 'BAJO'
                       ELSE 'PRECAUCION'
                   END as estado_stock,
                   (p.stock_minimo - p.stock_actual) as cantidad_faltante,
                   ROUND(((p.stock_minimo - p.stock_actual)::DECIMAL / NULLIF(p.stock_minimo, 0)) * 100, 1) as porcentaje_faltante
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
            WHERE p.activo = true AND p.stock_actual <= p.stock_minimo
            ORDER BY p.stock_actual ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/productos/resumen - Resumen del inventario
router.get('/resumen', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*) as total_productos,
                SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) as agotados,
                SUM(CASE WHEN stock_actual > 0 AND stock_actual <= stock_minimo THEN 1 ELSE 0 END) as criticos,
                SUM(CASE WHEN stock_actual > stock_minimo AND stock_actual <= stock_minimo * 1.5 THEN 1 ELSE 0 END) as bajos,
                SUM(CASE WHEN stock_actual > stock_minimo * 1.5 THEN 1 ELSE 0 END) as ok,
                SUM(stock_actual * precio_venta) as valor_total_inventario
            FROM productos WHERE activo = true
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/productos/:id - Obtener uno
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
            SELECT p.*, c.nombre as categoria_nombre, pr.nombre as proveedor_nombre
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
            WHERE p.id = $1
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/productos - Crear
router.post('/', async (req, res) => {
    try {
        const { codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id,
                precio_venta, costo_compra, stock_actual, stock_minimo, stock_maximo, ubicacion } = req.body;
        const result = await db.query(`
            INSERT INTO productos (codigo, nombre, descripcion, unidad_medida, categoria_id,
                proveedor_id, precio_venta, costo_compra, stock_actual, stock_minimo, stock_maximo, ubicacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id,
            precio_venta, costo_compra, stock_actual || 0, stock_minimo || 10, stock_maximo || 500, ubicacion]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/productos/:id - Actualizar
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id,
                precio_venta, costo_compra, stock_minimo, stock_maximo, ubicacion } = req.body;
        const result = await db.query(`
            UPDATE productos SET
                codigo = COALESCE($2, codigo),
                nombre = COALESCE($3, nombre),
                descripcion = COALESCE($4, descripcion),
                unidad_medida = COALESCE($5, unidad_medida),
                categoria_id = COALESCE($6, categoria_id),
                proveedor_id = COALESCE($7, proveedor_id),
                precio_venta = COALESCE($8, precio_venta),
                costo_compra = COALESCE($9, costo_compra),
                stock_minimo = COALESCE($10, stock_minimo),
                stock_maximo = COALESCE($11, stock_maximo),
                ubicacion = COALESCE($12, ubicacion)
            WHERE id = $1
            RETURNING *
        `, [id, codigo, nombre, descripcion, unidad_medida, categoria_id, proveedor_id,
            precio_venta, costo_compra, stock_minimo, stock_maximo, ubicacion]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/productos/:id - Eliminar
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('UPDATE productos SET activo = false WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
