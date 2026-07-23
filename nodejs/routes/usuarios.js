const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Middleware: solo admin
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
}

// GET /api/usuarios - Listar todos
router.get('/', requireAdmin, (req, res) => {
    try {
        const result = db.query(`
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

// POST /api/usuarios - Crear
router.post('/', requireAdmin, (req, res) => {
    try {
        const { nombre, email, password, rol, telefono } = req.body;
        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
        }

        // Check if email exists
        const exists = db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const id = crypto.randomUUID();
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const userRol = rol || 'consulta';

        db.query('INSERT INTO users (id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?)',
            [id, nombre, email, hash, userRol]);

        // Create perfil
        const perfilId = crypto.randomUUID();
        db.query('INSERT INTO perfil_usuario (id, user_id, nombre_completo, rol, telefono) VALUES (?, ?, ?, ?, ?)',
            [perfilId, id, nombre, userRol, telefono || '']);

        res.status(201).json({ id, nombre, email, rol: userRol });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/usuarios/:id - Actualizar
router.put('/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, password, rol, telefono } = req.body;

        const user = db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (password) {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password, salt);
            db.query('UPDATE users SET nombre = ?, email = ?, password_hash = ?, rol = ? WHERE id = ?',
                [nombre || user.rows[0].nombre, email || user.rows[0].email, hash, rol || user.rows[0].rol, id]);
        } else {
            db.query('UPDATE users SET nombre = ?, email = ?, rol = ? WHERE id = ?',
                [nombre || user.rows[0].nombre, email || user.rows[0].email, rol || user.rows[0].rol, id]);
        }

        // Update perfil
        db.query('UPDATE perfil_usuario SET nombre_completo = ?, rol = ?, telefono = ? WHERE user_id = ?',
            [nombre || user.rows[0].nombre, rol || user.rows[0].rol, telefono || '', id]);

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/usuarios/:id - Desactivar
router.delete('/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;

        // No permitir eliminarse a sí mismo
        if (req.session.user && req.session.user.id === id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        const result = db.query('UPDATE users SET activo = 0 WHERE id = ? RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
