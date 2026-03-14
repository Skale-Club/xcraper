
import fs from 'fs';
import path from 'path';
import { pool } from '../db';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRLSSetup() {
    try {
        const sqlPath = path.join(__dirname, '../db/rls-setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running RLS setup script...');
        
        // Execute the script
        // We use a single client to run the whole thing in a transaction if possible
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            console.log('Success: RLS and policies have been configured.');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error setting up RLS:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runRLSSetup();
