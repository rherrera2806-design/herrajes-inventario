const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { generarPdfCotizacion } = require('../services/pdfService');
const { enviarCotizacionEmail } = require('../services/emailService');

// GET /api/cotizaciones - Listar
router.get('/', async (req, res) => {
    try {
        const { estado } = req.query;
        let query = `
            SELECT c.*, cl.nombre as cliente_nombre, pu.nombre_completo as vendedor_nombre
            FROM cotizaciones c
            LEFT JOIN clientes cl ON cl.id = c.cliente_id
            LEFT JOIN perfil_usuario pu ON pu.user_id = c.usuario_id
        `;
        const params = [];
        if (estado) {
            query += ' WHERE c.estado = $1';
            params.push(estado);
        }
        query += ' ORDER BY c.created_at DESC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cotizaciones/:id - Obtener una
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cotizacion = await db.query(`
            SELECT c.*, cl.nombre as cliente_nombre, cl.rfc as cliente_rfc,
                   cl.telefono as cliente_telefono, cl.email as cliente_email,
                   cl.direccion as cliente_direccion, cl.ciudad as cliente_ciudad,
                   pu.nombre_completo as vendedor_nombre
            FROM cotizaciones c
            LEFT JOIN clientes cl ON cl.id = c.cliente_id
            LEFT JOIN perfil_usuario pu ON pu.user_id = c.usuario_id
            WHERE c.id = $1
        `, [id]);

        if (cotizacion.rows.length === 0) {
            return res.status(404).json({ error: 'Cotización no encontrada' });
        }

        const detalles = await db.query(`
            SELECT cd.*, p.codigo, p.nombre as producto_nombre, p.unidad_medida
            FROM cotizacion_detalles cd
            JOIN productos p ON p.id = cd.producto_id
            WHERE cd.cotizacion_id = $1
        `, [id]);

        res.json({
            ...cotizacion.rows[0],
            detalles: detalles.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cotizaciones - Crear
router.post('/', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { cliente_id, descuento_porcentaje, notas, detalles } = req.body;
        const usuario_id = req.session.user.id;

        // Crear cotización
        const cotizacion = await client.query(`
            INSERT INTO cotizaciones (cliente_id, usuario_id, fecha_cotizacion, fecha_vigencia,
                                     descuento_porcentaje, notas, estado)
            VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $3, $4, 'borrador')
            RETURNING *
        `, [cliente_id, usuario_id, descuento_porcentaje || 0, notas]);

        const cotizacionId = cotizacion.rows[0].id;

        // Insertar detalles
        for (const detalle of detalles) {
            const producto = await client.query('SELECT precio_venta FROM productos WHERE id = $1', [detalle.producto_id]);
            const precio = producto.rows[0].precio_venta;

            const subtotalLinea = precio * detalle.cantidad * (1 - (detalle.descuento_porcentaje || 0) / 100);

            await client.query(`
                INSERT INTO cotizacion_detalles (cotizacion_id, producto_id, cantidad,
                                                precio_unitario, descuento_porcentaje, subtotal_linea)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [cotizacionId, detalle.producto_id, detalle.cantidad, precio,
                detalle.descuento_porcentaje || 0, subtotalLinea]);
        }

        await client.query('COMMIT');

        // Recuperar totales calculados por trigger
        const resultado = await client.query('SELECT * FROM cotizaciones WHERE id = $1', [cotizacionId]);
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// POST /api/cotizaciones/:id/pdf - Generar PDF
router.post('/:id/pdf', async (req, res) => {
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

        const pdfBuffer = await generarPdfCotizacion(cotizacion.rows[0], detalles.rows);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cotizacion.rows[0].numero}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cotizaciones/:id/enviar - Generar PDF y enviar email
router.post('/:id/enviar', async (req, res) => {
    try {
        const { id } = req.params;
        const { email_destino } = req.body;

        const cotizacion = await db.query(`
            SELECT c.*, cl.nombre as cliente_nombre, cl.email as cliente_email
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

        // Generar PDF en memoria
        const pdfBuffer = await generarPdfCotizacion(cotizacion.rows[0], detalles.rows);

        // Enviar email
        const email = email_destino || cotizacion.rows[0].cliente_email;
        if (email) {
            await enviarCotizacionEmail(email, cotizacion.rows[0], pdfBuffer);
        }

        // Actualizar estado
        await db.query("UPDATE cotizaciones SET estado = 'enviada' WHERE id = $1", [id]);

        res.json({ message: 'Cotización generada y enviada', email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cotizaciones/:id/aprobar - Aprobar cotización
router.post('/:id/aprobar', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const usuario_id = req.session.user.id;

        // Verificar estado
        const cotizacion = await client.query(
            'SELECT * FROM cotizaciones WHERE id = $1 AND estado = $2',
            [id, 'enviada']
        );
        if (cotizacion.rows.length === 0) {
            throw new Error('Solo se pueden aprobar cotizaciones en estado ENVIADA');
        }

        // Verificar stock
        const detalles = await client.query(
            'SELECT cd.*, p.stock_actual, p.codigo FROM cotizacion_detalles cd JOIN productos p ON p.id = cd.producto_id WHERE cd.cotizacion_id = $1',
            [id]
        );

        for (const d of detalles.rows) {
            if (d.stock_actual < d.cantidad) {
                throw new Error(`Stock insuficiente para ${d.codigo}: disponible ${d.stock_actual}, solicitado ${d.cantidad}`);
            }
        }

        // Registrar salidas
        for (const d of detalles.rows) {
            await client.query(`
                INSERT INTO movimientos_stock (producto_id, tipo_movimiento, cantidad, motivo, referencia, usuario_id)
                VALUES ($1, 'salida', $2, 'Venta por cotización', $3, $4)
            `, [d.producto_id, d.cantidad, cotizacion.rows[0].numero, usuario_id]);
        }

        // Actualizar estado
        await client.query(
            "UPDATE cotizaciones SET estado = 'aprobada' WHERE id = $1",
            [id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Cotización aprobada y stock descontado' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
