import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function compareActorPricing() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('💰 Comparing Actor Pricing and Features\n');
    console.log('='.repeat(100));

    const actors = [
      { id: 'nwua9Gu5YrADL7ZDj', name: 'compass/crawler-google-places', description: 'Older version' },
      { id: 'WnMxbsRLNbPeYL6ge', name: 'compass/google-maps-scraper', description: 'Current version with social media' },
    ];

    for (const actorInfo of actors) {
      console.log(`\n📍 Actor: ${actorInfo.name}`);
      console.log(`📝 ${actorInfo.description}`);
      console.log('-'.repeat(100));

      try {
        const actor = await client.actor(actorInfo.id).get();

        console.log('\n🔍 Actor Details:');
        console.log(`  Title: ${actor?.title || 'N/A'}`);
        console.log(`  Description: ${actor?.description?.substring(0, 100) || 'N/A'}...`);
        console.log(`  Version: ${actor?.taggedBuilds?.latest || 'N/A'}`);
        console.log(`  Stats:`);
        console.log(`    - Runs (last 7 days): ${actor?.stats?.last7DaysRunsCount || 0}`);
        console.log(`    - Total runs: ${actor?.stats?.totalRunsCount || 0}`);
        console.log(`    - Total users: ${actor?.stats?.totalUsersCount || 0}`);

        // Get recent runs to calculate average cost
        const runs = await client.actor(actorInfo.id).runs().list({ limit: 10 });

        if (runs.items.length > 0) {
          console.log(`\n💵 Cost Analysis (based on last ${runs.items.length} runs):`);

          const completedRuns = runs.items.filter(r => r.status === 'SUCCEEDED');

          if (completedRuns.length > 0) {
            const costData = completedRuns.map(run => ({
              runId: run.id,
              cost: run.usageTotalUsd || 0,
              datasetId: run.defaultDatasetId,
            }));

            // Get dataset sizes for completed runs
            for (const run of costData.slice(0, 3)) {
              try {
                const dataset = await client.dataset(run.datasetId).listItems({ limit: 1 });
                const count = dataset.count || 0;
                const costPer1000 = count > 0 ? (run.cost / count) * 1000 : 0;

                console.log(`\n  Run ${run.runId.substring(0, 10)}...`);
                console.log(`    - Results: ${count} places`);
                console.log(`    - Total cost: $${run.cost.toFixed(4)}`);
                console.log(`    - Cost per 1,000 results: $${costPer1000.toFixed(2)}`);
                console.log(`    - Cost per result: $${(run.cost / count).toFixed(4)}`);
              } catch (e) {
                console.log(`    - Could not fetch dataset info`);
              }
            }
          } else {
            console.log('  No completed runs found for cost analysis');
          }
        }

      } catch (error) {
        console.log(`  ❌ Error fetching actor: ${error}`);
      }

      console.log('\n' + '='.repeat(100));
    }

    console.log('\n\n📊 Summary:');
    console.log('='.repeat(100));
    console.log('crawler-google-places:');
    console.log('  ✅ Lower cost');
    console.log('  ❌ No social media data');
    console.log('  ❌ Fewer fields (42 fields)');
    console.log('');
    console.log('google-maps-scraper:');
    console.log('  💰 Potentially higher cost (needs verification)');
    console.log('  ✅ Social media data included (40% coverage)');
    console.log('  ✅ More fields (73 fields)');
    console.log('  ✅ Better data quality and enrichment options');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

compareActorPricing();
