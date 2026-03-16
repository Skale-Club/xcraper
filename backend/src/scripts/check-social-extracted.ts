import { db } from '../db';
import { contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const searchId = 'c95f0656-d3e6-48a8-acb8-98a8364611be';

async function checkSocialExtracted() {
  try {
    console.log('🔍 Checking extracted social media data...\n');

    const searchContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.searchId, searchId));

    console.log(`Found ${searchContacts.length} contacts\n`);

    let contactsWithSocial = 0;

    searchContacts.forEach((contact, idx) => {
      const hasSocial =
        contact.facebook ||
        contact.instagram ||
        contact.twitter ||
        contact.linkedin ||
        contact.youtube ||
        contact.tiktok ||
        contact.pinterest;

      if (hasSocial) {
        contactsWithSocial++;
        console.log(`${'='.repeat(60)}`);
        console.log(`${idx + 1}. ${contact.title}`);
        console.log(`${'='.repeat(60)}`);

        if (contact.facebook) console.log(`  📘 Facebook: ${contact.facebook}`);
        if (contact.instagram) console.log(`  📸 Instagram: ${contact.instagram}`);
        if (contact.twitter) console.log(`  🐦 Twitter: ${contact.twitter}`);
        if (contact.linkedin) console.log(`  💼 LinkedIn: ${contact.linkedin}`);
        if (contact.youtube) console.log(`  📺 YouTube: ${contact.youtube}`);
        if (contact.tiktok) console.log(`  🎵 TikTok: ${contact.tiktok}`);
        if (contact.pinterest) console.log(`  📌 Pinterest: ${contact.pinterest}`);
        console.log();
      }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary:');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total: ${searchContacts.length}`);
    console.log(`With social media: ${contactsWithSocial}`);
    console.log(`Percentage: ${((contactsWithSocial / searchContacts.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSocialExtracted();
