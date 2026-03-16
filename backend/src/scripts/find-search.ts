import { db } from '../db';
import { searchHistory, contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const searchId = 'c95f0656-d3e6-48a8-acb8-98a8364611be';

async function findSearch() {
  try {
    console.log('🔍 Looking for search:', searchId);

    // Find the search
    const search = await db.query.searchHistory.findFirst({
      where: eq(searchHistory.id, searchId),
      with: {
        user: true
      }
    });

    if (!search) {
      console.log('❌ Search not found');
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

    if (search.apifyRunId) {
      console.log('Apify Run ID:', search.apifyRunId);
    }

    // Count contacts for this search
    const contactsCount = await db
      .select()
      .from(contacts)
      .where(eq(contacts.searchId, searchId));

    console.log('\n📊 Contacts:');
    console.log('==================');
    console.log('Total contacts saved:', contactsCount.length);

    if (contactsCount.length > 0) {
      console.log('\nSample contacts:');
      contactsCount.slice(0, 5).forEach((contact, idx) => {
        console.log(`\n${idx + 1}. ${contact.title}`);
        console.log(`   Category: ${contact.category || 'N/A'}`);
        console.log(`   Phone: ${contact.phone || 'N/A'}`);
        console.log(`   Address: ${contact.address || 'N/A'}`);
        console.log(`   Rating: ${contact.rating || 'N/A'}`);
      });
    }

    console.log('\n✅ Search details retrieved successfully');
  } catch (error) {
    console.error('❌ Error finding search:', error);
  } finally {
    process.exit(0);
  }
}

findSearch();
