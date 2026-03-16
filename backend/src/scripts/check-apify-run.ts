import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

const runId = '79822a0d-19ab-4b82-8f4e-3d824acee4a1';

async function checkApifyRun() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Fetching Apify run:', runId);
    console.log('');

    const run = await client.run(runId).get();

    console.log('✅ Run Details:');
    console.log('='.repeat(80));
    console.log('Run ID:', run.id);
    console.log('Actor ID:', run.actId);
    console.log('Actor Name:', run.actorTaskId || 'N/A');
    console.log('Status:', run.status);
    console.log('Started At:', run.startedAt);
    console.log('Finished At:', run.finishedAt);
    console.log('Dataset ID:', run.defaultDatasetId);
    console.log('');

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

      console.log('🔍 First Result Structure:');
      console.log('='.repeat(80));
      console.log('Title:', firstResult.title);
      console.log('Category:', firstResult.categoryName || firstResult.category);
      console.log('Address:', firstResult.address);
      console.log('Phone:', firstResult.phone);
      console.log('Website:', firstResult.website);
      console.log('Email:', firstResult.email);
      console.log('');

      // Check for social media fields
      console.log('📱 Social Media Fields Available:');
      console.log('='.repeat(80));

      const socialFields = [
        'facebooks', 'instagrams', 'twitters', 'linkedIns', 'youtubes',
        'tiktoks', 'pinterests', 'snapchats', 'telegrams', 'whatsapps',
        'reddits', 'threads', 'discords'
      ];

      socialFields.forEach(field => {
        if (field in firstResult) {
          const value = (firstResult as any)[field];
          const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
          console.log(`  ${field}: ${isEmpty ? '❌ empty' : '✅ ' + JSON.stringify(value)}`);
        } else {
          console.log(`  ${field}: ⚠️  field not present`);
        }
      });

      console.log('');
      console.log('🔑 All Available Fields:');
      console.log('='.repeat(80));
      console.log(Object.keys(firstResult).join(', '));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkApifyRun();
