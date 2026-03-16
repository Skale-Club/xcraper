import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

const runId = 'lVu0aX7fljV28CTrD'; // The other recent run

async function analyzeRun() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Analyzing Apify run:', runId);
    console.log('');

    const run = await client.run(runId).get();

    if (!run) {
      console.log('❌ Run not found');
      return;
    }

    console.log('✅ Run Details:');
    console.log('='.repeat(80));
    console.log('Run ID:', run.id);
    console.log('Actor ID:', run.actId);
    console.log('Status:', run.status);
    console.log('Started At:', run.startedAt);
    console.log('Finished At:', run.finishedAt);
    console.log('Dataset ID:', run.defaultDatasetId);
    console.log('');

    // Try to get actor details
    try {
      const actor = await client.actor(run.actId).get();
      console.log('🎭 Actor Information:');
      console.log('='.repeat(80));
      console.log('Actor Name:', actor?.name || 'Unknown');
      console.log('Title:', actor?.title || 'Unknown');
      console.log('Username:', actor?.username || 'Unknown');
      console.log('');
    } catch (actorError) {
      console.log('⚠️  Could not fetch actor details\n');
    }

    // Get input
    const input = await client.run(runId).input().get();
    console.log('📝 Input Parameters:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(input, null, 2));
    console.log('');

    // Get results
    console.log('📊 Fetching results from dataset...');
    const dataset = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Found ${dataset.items.length} results`);
    console.log('');

    if (dataset.items.length > 0) {
      const firstResult = dataset.items[0];

      console.log('🔍 First Result:');
      console.log('='.repeat(80));
      console.log('Title:', firstResult.title);
      console.log('Category:', firstResult.categoryName || firstResult.category);
      console.log('Address:', firstResult.address);
      console.log('Phone:', firstResult.phone);
      console.log('Website:', firstResult.website);
      console.log('Email:', firstResult.email || 'N/A');
      console.log('');

      // Check for social media fields
      console.log('📱 Social Media Analysis:');
      console.log('='.repeat(80));

      const socialFields = {
        facebooks: 'Facebook',
        instagrams: 'Instagram',
        twitters: 'Twitter',
        linkedIns: 'LinkedIn',
        youtubes: 'YouTube',
        tiktoks: 'TikTok',
        pinterests: 'Pinterest',
      };

      let hasSocial = false;

      Object.entries(socialFields).forEach(([field, label]) => {
        if (field in firstResult) {
          const value = (firstResult as any)[field];
          if (Array.isArray(value) && value.length > 0) {
            console.log(`  ✅ ${label}: ${value[0]}`);
            hasSocial = true;
          } else if (Array.isArray(value)) {
            console.log(`  ❌ ${label}: empty array`);
          } else if (value) {
            console.log(`  ✅ ${label}: ${value}`);
            hasSocial = true;
          }
        }
      });

      if (!hasSocial) {
        console.log('  ⚠️  No social media data found in first result');
      }

      console.log('');

      // Count results with social media
      let withSocial = 0;
      dataset.items.forEach((item: any) => {
        const has = Object.keys(socialFields).some(field => {
          const value = item[field];
          return Array.isArray(value) ? value.length > 0 : !!value;
        });
        if (has) withSocial++;
      });

      console.log('📊 Social Media Summary:');
      console.log('='.repeat(80));
      console.log(`Results with social media: ${withSocial}/${dataset.items.length} (${((withSocial/dataset.items.length)*100).toFixed(1)}%)`);
      console.log('');

      console.log('🔑 All Available Fields in Results:');
      console.log('='.repeat(80));
      console.log(Object.keys(firstResult).sort().join(', '));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

analyzeRun();
