import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function compareRunsRaw() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    // Run que TEM social media
    const run1Id = 'N5ebsc6Gf8RT2gb38';
    // Run que NÃO TEM social media
    const run2Id = 'yEiygTTuUb6jKC6I4';

    console.log('=== RUN COM SOCIAL MEDIA ===');
    const run1 = await client.run(run1Id).get();
    const ds1 = await client.dataset(run1.defaultDatasetId).listItems({ limit: 1 });
    const item1 = ds1.items[0];
    console.log('Actor ID:', run1.actId);
    console.log('Fields:', Object.keys(item1).sort().join(', '));
    console.log('Has facebooks?', 'facebooks' in item1);
    console.log('');

    console.log('=== RUN SEM SOCIAL MEDIA ===');
    const run2 = await client.run(run2Id).get();
    const ds2 = await client.dataset(run2.defaultDatasetId).listItems({ limit: 1 });
    const item2 = ds2.items[0];
    console.log('Actor ID:', run2.actId);
    console.log('Fields:', Object.keys(item2).sort().join(', '));
    console.log('Has facebooks?', 'facebooks' in item2);

    console.log('\n=== DIFERENÇA DE CAMPOS ===');
    const fields1 = new Set(Object.keys(item1));
    const fields2 = new Set(Object.keys(item2));

    const onlyIn1 = [...fields1].filter(f => !fields2.has(f));
    const onlyIn2 = [...fields2].filter(f => !fields1.has(f));

    console.log('Campos que SÓ existem na run COM social media:');
    console.log(' ', onlyIn1.join(', '));
    console.log('');
    console.log('Campos que SÓ existem na run SEM social media:');
    console.log(' ', onlyIn2.join(', '));

    console.log('\n=== ACTOR IDs SÃO O MESMO? ===');
    console.log(`Run 1: ${run1.actId}`);
    console.log(`Run 2: ${run2.actId}`);
    console.log(`Mesmo actor? ${run1.actId === run2.actId ? 'SIM' : 'NÃO'}`);

    console.log('\n=== BUILD NUMBERS ===');
    console.log(`Run 1 build: ${run1.buildNumber}`);
    console.log(`Run 2 build: ${run2.buildNumber}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

compareRunsRaw();
