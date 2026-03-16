import { db } from '../db';
import { sql } from 'drizzle-orm';

async function addIsArchivedColumn() {
    try {
        console.log('Adding is_archived column to contacts table...');
        await db.execute(sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false`);
        console.log('Done.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

addIsArchivedColumn();
