const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/clientes
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM clientes WHERE activo = true ORDER BY nombre');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/clientes
router.post('/', async (req, res) => {
    try {
        const { nombre, rfc, telefono, email, direccion, ciudad } = req.body;
        const result = await db.query(`
            INSERT INTO clientes (nombre, rfc, telefono, email, direccion, ciudad)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [nombre, rfc, telefono, email, direccion, ciudad]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, rfc, telefono, email, direccion, ciudad } = req.body;
        const result = await db.query(`
            UPDATE clientes SET
                nombre = COALESCE($2, nombre),
                rfc = COALESCE($3, rfc),
                telefono = COALESCE($4, telefono),
                email = COALESCE($5, email),
                direccion = COALESCE($6, direccion),
                ciudad = COALESCE($7, ciudad)
            WHERE id = $1
            RETURNING *
        `, [id, nombre, rfc, telefono, email, direccion, ciudad]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/clientes/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('UPDATE clientes SET activo = false WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ message: 'Cliente eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
