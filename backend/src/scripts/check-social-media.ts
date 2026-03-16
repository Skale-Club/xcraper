import { db } from '../db';
import { contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const searchId = 'c95f0656-d3e6-48a8-acb8-98a8364611be';

async function checkSocialMedia() {
  try {
    console.log('🔍 Checking social media data for search:', searchId);

    // Get all contacts from this search
    const searchContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.searchId, searchId));

    console.log(`\n📊 Found ${searchContacts.length} contacts\n`);

    let contactsWithSocial = 0;
    const socialMediaTypes = new Set<string>();

    searchContacts.forEach((contact, idx) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`${idx + 1}. ${contact.title}`);
      console.log(`${'='.repeat(60)}`);

      // Check rawData for social media
      if (contact.rawData) {
        const raw = contact.rawData as any;

        // Common social media fields in Apify Google Maps scraper
        const socialFields = [
          'socialMedia',
          'facebook',
          'instagram',
          'twitter',
          'linkedin',
          'youtube',
          'tiktok',
          'pinterest',
          'snapchat'
        ];

        let hasSocial = false;

        socialFields.forEach(field => {
          if (raw[field]) {
            hasSocial = true;
            socialMediaTypes.add(field);
            console.log(`  ✅ ${field}:`, raw[field]);
          }
        });

        // Check if there's a nested socialMedia object
        if (raw.socialMedia && typeof raw.socialMedia === 'object') {
          console.log('  📱 Social Media Object:');
          Object.entries(raw.socialMedia).forEach(([platform, url]) => {
            if (url) {
              socialMediaTypes.add(platform);
              console.log(`    - ${platform}: ${url}`);
            }
          });
          hasSocial = true;
        }

        // Show all available fields in rawData
        console.log('\n  📋 Available fields in rawData:');
        console.log('  ', Object.keys(raw).join(', '));

        if (hasSocial) {
          contactsWithSocial++;
        } else {
          console.log('  ❌ No social media data found');
        }
      } else {
        console.log('  ⚠️  No rawData available');
      }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary:');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total contacts: ${searchContacts.length}`);
    console.log(`Contacts with social media: ${contactsWithSocial}`);
    console.log(`Social media platforms found: ${Array.from(socialMediaTypes).join(', ') || 'None'}`);
    console.log(`Percentage with social: ${((contactsWithSocial / searchContacts.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error checking social media:', error);
  } finally {
    process.exit(0);
  }
}

checkSocialMedia();
