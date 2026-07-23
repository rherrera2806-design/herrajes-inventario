require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const client = await pool.connect();
    try {
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
        
        const sessionTable = tables.rows.find(r => r.table_name === 'user_sessions');
        console.log('user_sessions exists:', !!sessionTable);
        
        // Test login endpoint
        const user = await client.query("SELECT id, email, password_hash FROM users WHERE email = 'admin@herrajes.local'");
        console.log('Admin user found:', user.rows.length > 0);
        if (user.rows.length > 0) {
            console.log('Has password_hash:', !!user.rows[0].password_hash);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(e => { console.error(e.message); process.exit(1); });
