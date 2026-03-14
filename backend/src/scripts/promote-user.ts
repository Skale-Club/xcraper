
import { pool } from '../db';

async function promote() {
    try {
        await pool.query("UPDATE users SET role = 'admin' WHERE email = 'vanildinho@gmail.com'");
        console.log('Promoted vanildinho@gmail.com to admin');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

promote();
