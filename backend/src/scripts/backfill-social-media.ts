import { db } from '../db';
import { contacts } from '../db/schema';
import { extractSocialMediaFromRawData } from '../utils/socialMedia';
import { sql } from 'drizzle-orm';

async function backfillSocialMedia() {
  try {
    console.log('🔄 Starting social media backfill...\n');

    // Get all contacts
    const allContacts = await db.select().from(contacts);
    console.log(`📊 Found ${allContacts.length} contacts to process\n`);

    let updated = 0;
    let skipped = 0;
    let withSocialMedia = 0;

    for (const contact of allContacts) {
      if (!contact.rawData) {
        skipped++;
        continue;
      }

      const socialMedia = extractSocialMediaFromRawData(contact.rawData);

      // Check if we have any social media to update
      const hasSocialMedia = Object.values(socialMedia).some(v => v);

      if (!hasSocialMedia) {
        skipped++;
        continue;
      }

      // Update the contact
      await db.update(contacts)
        .set(socialMedia)
        .where(sql`${contacts.id} = ${contact.id}`);

      updated++;
      withSocialMedia++;

      // Log progress every 10 contacts
      if (updated % 10 === 0) {
        console.log(`✅ Updated ${updated} contacts...`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`Total contacts processed: ${allContacts.length}`);
    console.log(`Updated with social media: ${withSocialMedia}`);
    console.log(`Skipped (no social media): ${skipped}`);
    console.log(`\n✅ Backfill completed successfully!`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
  } finally {
    process.exit(0);
  }
}

backfillSocialMedia();
