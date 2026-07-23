const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const bcrypt = require('bcryptjs');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        const result = await db.query('SELECT * FROM users WHERE email = $1 AND activo = true', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Get perfil
        const perfil = await db.query('SELECT * FROM perfil_usuario WHERE user_id = $1', [user.id]);

        req.session.user = {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            telefono: perfil.rows.length ? perfil.rows[0].telefono : ''
        };

        res.json({ ok: true, user: req.session.user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    res.json(req.session.user);
});

module.exports = router;
