import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function listApifyRuns() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Fetching recent Apify runs...\n');

    // Get user info to find actors
    const user = await client.user().get();
    console.log(`Logged in as: ${user?.username || 'Unknown'}\n`);

    // List recent runs
    const runs = await client.runs().list({ limit: 20 });

    console.log(`Found ${runs.items.length} recent runs:\n`);
    console.log('='.repeat(100));

    runs.items.forEach((run, idx) => {
      console.log(`${idx + 1}. Run ID: ${run.id}`);
      console.log(`   Actor: ${run.actId}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Started: ${run.startedAt}`);
      console.log(`   Finished: ${run.finishedAt || 'N/A'}`);
      console.log(`   Dataset: ${run.defaultDatasetId}`);
      console.log('   ' + '-'.repeat(96));
    });

    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listApifyRuns();
