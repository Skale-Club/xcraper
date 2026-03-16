import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function compareActors() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Comparing the two Google Maps scrapers...\n');

    const runs = [
      { id: 'lVu0aX7fljV28CTrD', name: 'compass/crawler-google-places', actorId: 'nwua9Gu5YrADL7ZDj' },
      { id: 'N5ebsc6Gf8RT2gb38', name: 'compass/google-maps-scraper', actorId: 'WnMxbsRLNbPeYL6ge' },
    ];

    for (const runInfo of runs) {
      console.log('='.repeat(100));
      console.log(`🎭 Actor: ${runInfo.name}`);
      console.log(`🆔 Run ID: ${runInfo.id}`);
      console.log('='.repeat(100));

      const run = await client.run(runInfo.id).get();
      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });

      console.log(`\n📊 Results: ${dataset.items.length} items (showing first result)\n`);

      if (dataset.items.length > 0) {
        const firstResult = dataset.items[0];

        console.log('📋 Basic Info:');
        console.log(`  Title: ${firstResult.title}`);
        console.log(`  Category: ${firstResult.categoryName || firstResult.category || 'N/A'}`);
        console.log(`  Phone: ${firstResult.phone || 'N/A'}`);
        console.log(`  Website: ${firstResult.website || 'N/A'}`);
        console.log(`  Email: ${firstResult.email || 'N/A'}`);

        console.log('\n📱 Social Media Fields:');

        const socialFields = {
          facebooks: 'Facebook',
          instagrams: 'Instagram',
          twitters: 'Twitter/X',
          linkedIns: 'LinkedIn',
          youtubes: 'YouTube',
          tiktoks: 'TikTok',
          pinterests: 'Pinterest',
          snapchats: 'Snapchat',
          telegrams: 'Telegram',
          whatsapps: 'WhatsApp',
        };

        let foundSocial = false;

        Object.entries(socialFields).forEach(([field, label]) => {
          if (field in firstResult) {
            const value = (firstResult as any)[field];
            if (Array.isArray(value)) {
              if (value.length > 0) {
                console.log(`  ✅ ${label.padEnd(12)}: ${value[0]}`);
                foundSocial = true;
              } else {
                console.log(`  ⚪ ${label.padEnd(12)}: (empty array)`);
              }
            } else if (value) {
              console.log(`  ✅ ${label.padEnd(12)}: ${value}`);
              foundSocial = true;
            }
          } else {
            console.log(`  ❌ ${label.padEnd(12)}: field not present`);
          }
        });

        if (!foundSocial) {
          console.log('\n  ⚠️  No social media data found!');
        }

        // Count total with social media
        let withSocial = 0;
        dataset.items.forEach((item: any) => {
          const has = Object.keys(socialFields).some(field => {
            const value = item[field];
            return Array.isArray(value) ? value.length > 0 : !!value;
          });
          if (has) withSocial++;
        });

        console.log(`\n📊 Social Media Coverage: ${withSocial}/${dataset.items.length} items (${((withSocial/dataset.items.length)*100).toFixed(1)}%)`);

        console.log('\n🔑 All Fields Available:');
        const fields = Object.keys(firstResult).sort();
        fields.forEach((field, idx) => {
          if (idx % 5 === 0) console.log('');
          process.stdout.write(`  ${field.padEnd(25)}`);
        });
        console.log('\n');
      }
    }

    console.log('='.repeat(100));
    console.log('\n✅ Comparison complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

compareActors();
