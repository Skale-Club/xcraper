
import { pool } from '../db';

async function checkAdmins() {
    try {
        const res = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin'");
        console.log('Current admins in database:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAdmins();
