import { db } from '../db';
import { sql } from 'drizzle-orm';

async function addSocialMediaColumns() {
  try {
    console.log('📝 Adding social media columns to contacts table...');

    // Add columns for social media
    const columns = [
      'facebook',
      'instagram',
      'twitter',
      'linkedin',
      'youtube',
      'tiktok',
      'pinterest',
    ];

    for (const column of columns) {
      try {
        await db.execute(sql.raw(`
          ALTER TABLE contacts
          ADD COLUMN IF NOT EXISTS ${column} TEXT;
        `));
        console.log(`✅ Added column: ${column}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⏭️  Column ${column} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ All social media columns added successfully!');
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    process.exit(0);
  }
}

addSocialMediaColumns();
