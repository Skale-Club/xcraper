
import fs from 'fs';
import path from 'path';
import { pool } from '../db/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runManualSync() {
    console.log('Starting manual database sync...');
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../db/manual-sync.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('Database schema synced successfully!');
    } catch (err) {
        console.error('Error syncing database schema:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runManualSync();
