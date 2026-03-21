import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function listCompassActors() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Listando actors da Compass disponíveis...\n');

    // Get account info
    const user = await client.user().get();
    console.log(`Conta: ${user?.username}\n`);

    // List actors from Compass
    const store = await client.store().list({
      search: 'compass google maps',
      limit: 20
    });

    console.log(`Encontrados ${store.items.length} actors:\n`);
    console.log('='.repeat(100));

    for (const item of store.items) {
      if (item.username === 'compass' && item.name.toLowerCase().includes('google')) {
        console.log(`\n📍 ${item.title}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Name: ${item.username}/${item.name}`);
        console.log(`   Description: ${item.description?.substring(0, 100)}...`);

        // Try to get more details
        try {
          const actor = await client.actor(item.id).get();
          console.log(`   Stats: ${actor?.stats?.totalRuns || 0} runs total`);
        } catch (e) {
          // ignore
        }

        console.log('   -'.repeat(50));
      }
    }

    console.log('\n\n🎯 Vou verificar qual tem campos de social media...\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

listCompassActors();
