import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function detailedCostAnalysis() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('💰 Detailed Cost Analysis of Recent Runs\n');

    const runs = [
      { id: 'lVu0aX7fljV28CTrD', actor: 'crawler-google-places' },
      { id: 'N5ebsc6Gf8RT2gb38', actor: 'google-maps-scraper' },
    ];

    for (const runInfo of runs) {
      console.log('='.repeat(100));
      console.log(`🔍 Run: ${runInfo.id}`);
      console.log(`🎭 Actor: ${runInfo.actor}`);
      console.log('='.repeat(100));

      const run = await client.run(runInfo.id).get();

      if (!run) {
        console.log(`❌ Run ${runInfo.id} not found`);
        continue;
      }

      console.log('\n📊 Run Details:');
      console.log(`  Status: ${run.status}`);
      console.log(`  Started: ${run.startedAt}`);
      console.log(`  Finished: ${run.finishedAt}`);
      console.log(`  Duration: ${(run as any).buildDurationSecs || 0}s build + ${(run as any).runDurationSecs || 0}s run`);

      console.log('\n💵 Cost Breakdown:');
      console.log(`  Compute Units Used: ${(run as any).usageTotalComputeUnits || 0} CU`);
      console.log(`  Total Cost USD: $${(run.usageTotalUsd || 0).toFixed(4)}`);
      console.log(`  Data Transfer: ${(run as any).usageDataTransferBytes || 0} bytes`);

      console.log('\n📦 Dataset:');
      const dataset = await client.dataset(run.defaultDatasetId).listItems();
      console.log(`  Results Count: ${dataset.count || dataset.items.length}`);
      console.log(`  Item Count: ${dataset.items.length}`);

      if (dataset.count > 0 || dataset.items.length > 0) {
        const count = dataset.count || dataset.items.length;
        const costPerResult = (run.usageTotalUsd || 0) / count;
        const costPer1000 = costPerResult * 1000;

        console.log('\n💰 Cost Metrics:');
        console.log(`  Cost per result: $${costPerResult.toFixed(4)}`);
        console.log(`  Cost per 1,000 results: $${costPer1000.toFixed(2)}`);
        console.log(`  Cost per 100 results: $${(costPerResult * 100).toFixed(3)}`);
      }

      // Check input parameters
      const buildRun = await client.run(runInfo.id).get();

      console.log('\n⚙️  Build/Actor Info:');
      console.log(`  Actor ID: ${run.actId}`);
      console.log(`  Build ID: ${run.buildId}`);
      console.log(`  Build Number: ${run.buildNumber}`);

      console.log('\n');
    }

    console.log('='.repeat(100));
    console.log('\n📈 Comparison Summary:\n');

    const run1 = await client.run(runs[0].id).get();
    if (!run1) throw new Error('Run 1 not found');
    const dataset1 = await client.dataset(run1.defaultDatasetId).listItems();
    const count1 = dataset1.count || dataset1.items.length;

    const run2 = await client.run(runs[1].id).get();
    if (!run2) throw new Error('Run 2 not found');
    const dataset2 = await client.dataset(run2.defaultDatasetId).listItems();
    const count2 = dataset2.count || dataset2.items.length;

    console.log('crawler-google-places:');
    console.log(`  ├─ Results: ${count1}`);
    console.log(`  ├─ Total Cost: $${(run1.usageTotalUsd || 0).toFixed(4)}`);
    console.log(`  ├─ Cost per result: $${((run1.usageTotalUsd || 0) / count1).toFixed(4)}`);
    console.log(`  └─ Cost per 1,000: $${(((run1.usageTotalUsd || 0) / count1) * 1000).toFixed(2)}`);

    console.log('\ngoogle-maps-scraper:');
    console.log(`  ├─ Results: ${count2}`);
    console.log(`  ├─ Total Cost: $${(run2.usageTotalUsd || 0).toFixed(4)}`);
    console.log(`  ├─ Cost per result: $${count2 > 0 ? ((run2.usageTotalUsd || 0) / count2).toFixed(4) : 'N/A'}`);
    console.log(`  └─ Cost per 1,000: $${count2 > 0 ? (((run2.usageTotalUsd || 0) / count2) * 1000).toFixed(2) : 'N/A'}`);

    if (count1 > 0 && count2 > 0) {
      const cost1 = (run1.usageTotalUsd || 0) / count1;
      const cost2 = (run2.usageTotalUsd || 0) / count2;
      const diff = ((cost2 - cost1) / cost1) * 100;

      console.log('\n💡 Analysis:');
      if (cost2 === 0) {
        console.log('  ⚠️  google-maps-scraper shows $0 cost - possibly free trial or test run');
      } else if (cost2 > cost1) {
        console.log(`  ❗ google-maps-scraper is ${Math.abs(diff).toFixed(1)}% MORE expensive`);
      } else {
        console.log(`  ✅ google-maps-scraper is ${Math.abs(diff).toFixed(1)}% CHEAPER`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

detailedCostAnalysis();
