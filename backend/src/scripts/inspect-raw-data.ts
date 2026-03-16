import { db } from '../db';
import { contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const searchId = 'c95f0656-d3e6-48a8-acb8-98a8364611be';

async function inspectRawData() {
  try {
    // Get first contact to inspect full rawData
    const contact = await db
      .select()
      .from(contacts)
      .where(eq(contacts.searchId, searchId))
      .limit(1);

    if (contact.length === 0) {
      console.log('No contacts found');
      return;
    }

    const rawData = contact[0].rawData as any;

    console.log('📋 Full rawData structure for:', contact[0].title);
    console.log('='.repeat(80));
    console.log(JSON.stringify(rawData, null, 2));

    console.log('\n\n🔍 Social Media Fields:');
    console.log('='.repeat(80));

    const socialFields = [
      'facebooks', 'instagrams', 'twitters', 'linkedIns', 'youtubes',
      'tiktoks', 'pinterests', 'snapchats', 'telegrams', 'whatsapps',
      'reddits', 'threads', 'discords'
    ];

    socialFields.forEach(field => {
      if (field in rawData) {
        const value = rawData[field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const length = Array.isArray(value) ? value.length : 'N/A';
        console.log(`\n${field}:`);
        console.log(`  Type: ${type}`);
        console.log(`  Length: ${length}`);
        console.log(`  Value:`, value);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

inspectRawData();
