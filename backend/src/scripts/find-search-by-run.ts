import { db } from '../db';
import { searchHistory, contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const apifyRunId = '79822a0d-19ab-4b82-8f4e-3d824acee4a1';

async function findSearchByRun() {
  try {
    console.log('🔍 Looking for search with Apify Run ID:', apifyRunId);

    // Find the search by apifyRunId
    const search = await db.query.searchHistory.findFirst({
      where: eq(searchHistory.apifyRunId, apifyRunId),
      with: {
        user: true
      }
    });

    if (!search) {
      console.log('❌ Search not found for this Apify Run ID');
      return;
    }

    console.log('\n✅ Search found:');
    console.log('==================');
    console.log('ID:', search.id);
    console.log('Query:', search.query);
    console.log('Location:', search.location);
    console.log('Status:', search.status);
    console.log('Total Results:', search.totalResults);
    console.log('Credits Used:', search.creditsUsed);
    console.log('Created At:', search.createdAt);
    console.log('Completed At:', search.completedAt);
    console.log('User:', search.user?.email || 'N/A');
    console.log('Apify Run ID:', search.apifyRunId);
    console.log('Apify Actor:', search.apifyActorName);

    // Count contacts for this search
    const searchContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.searchId, search.id));

    console.log('\n📊 Contacts:');
    console.log('==================');
    console.log('Total contacts saved:', searchContacts.length);

    if (searchContacts.length > 0) {
      console.log('\nSample contacts (first 5):');
      searchContacts.slice(0, 5).forEach((contact, idx) => {
        console.log(`\n${idx + 1}. ${contact.title}`);
        console.log(`   Category: ${contact.category || 'N/A'}`);
        console.log(`   Phone: ${contact.phone || 'N/A'}`);
        console.log(`   Address: ${contact.address || 'N/A'}`);
        console.log(`   Rating: ${contact.rating || 'N/A'}`);

        // Social Media
        const hasSocial = contact.facebook || contact.instagram || contact.twitter ||
                         contact.linkedin || contact.youtube || contact.tiktok || contact.pinterest;
        if (hasSocial) {
          console.log('   Social Media:');
          if (contact.facebook) console.log(`     📘 Facebook: ${contact.facebook}`);
          if (contact.instagram) console.log(`     📸 Instagram: ${contact.instagram}`);
          if (contact.twitter) console.log(`     🐦 Twitter: ${contact.twitter}`);
          if (contact.linkedin) console.log(`     💼 LinkedIn: ${contact.linkedin}`);
          if (contact.youtube) console.log(`     📺 YouTube: ${contact.youtube}`);
          if (contact.tiktok) console.log(`     🎵 TikTok: ${contact.tiktok}`);
          if (contact.pinterest) console.log(`     📌 Pinterest: ${contact.pinterest}`);
        }
      });

      // Count contacts with social media
      const withSocial = searchContacts.filter(c =>
        c.facebook || c.instagram || c.twitter || c.linkedin ||
        c.youtube || c.tiktok || c.pinterest
      ).length;

      console.log('\n' + '='.repeat(60));
      console.log('📊 Social Media Summary:');
      console.log('='.repeat(60));
      console.log(`Contacts with social media: ${withSocial}/${searchContacts.length} (${((withSocial/searchContacts.length)*100).toFixed(1)}%)`);
    }

    console.log('\n✅ Search details retrieved successfully');
  } catch (error) {
    console.error('❌ Error finding search:', error);
  } finally {
    process.exit(0);
  }
}

findSearchByRun();
