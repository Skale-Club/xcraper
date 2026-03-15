
import { pool } from '../db/index.js';

async function setAdmin() {
    try {
        const email = 'skale.club@gmail.com';
        const res = await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
        if (res.rowCount === 0) {
            console.log(`User ${email} not found in database.`);
        } else {
            console.log(`User ${email} has been promoted to admin.`);
        }
        
        const currentAdmins = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin'");
        console.log('Current admins:', currentAdmins.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

setAdmin();
