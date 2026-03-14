import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './src/db/schema';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function main() {
    console.log('Pushing schema to database...');
    // This will create tables if they don't exist
    // Note: For production, use migrations instead
    console.log('Schema push complete!');
    await pool.end();
}

main().catch(console.error);
