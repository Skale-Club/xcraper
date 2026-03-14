
import { pool } from '../db';

async function demote() {
    try {
        await pool.query("UPDATE users SET role = 'user' WHERE email = 'vanildinho@gmail.com'");
        console.log('Demoted vanildinho@gmail.com to user');
        const res = await pool.query('SELECT id, email, role FROM users');
        console.log('Current users:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

demote();
