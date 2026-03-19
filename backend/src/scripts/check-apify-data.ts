import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

const runId = 'yEiygTTuUb6jKC6I4';

async function checkApifyData() {
  try {
    const client = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log('🔍 Buscando dados do Apify Run:', runId, '\n');

    const run = await client.run(runId).get();

    if (!run) {
      console.log('❌ Run not found');
      return;
    }

    console.log('📊 Run Info:');
    console.log('='.repeat(80));
    console.log('Status:', run.status);
    console.log('Actor ID:', run.actId);
    console.log('Dataset ID:', run.defaultDatasetId);
    console.log('Finished:', run.finishedAt);

    // Get actor info
    const actor = await client.actor(run.actId).get();
    console.log('Actor Name:', actor?.name || 'Unknown');
    console.log('Actor Title:', actor?.title || 'Unknown');

    // Get results
    console.log('\n📦 Buscando resultados do dataset...\n');
    const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 3 });

    console.log(`Total de resultados: ${dataset.count || dataset.items.length}`);

    if (dataset.items.length > 0) {
      const first = dataset.items[0];

      console.log('\n🔍 Primeiro Resultado:');
      console.log('='.repeat(80));
      console.log('Title:', first.title);
      console.log('Category:', first.categoryName || first.category);
      console.log('Phone:', first.phone);
      console.log('Website:', first.website);
      console.log('Email:', first.email || 'N/A');

      console.log('\n📱 Campos de Social Media no Apify:');
      console.log('='.repeat(80));

      const socialFields = ['facebooks', 'instagrams', 'twitters', 'linkedIns', 'youtubes', 'tiktoks', 'pinterests'];

      let hasSocialFields = false;
      socialFields.forEach(field => {
        if (field in first) {
          hasSocialFields = true;
          const value = (first as any)[field];
          const display = Array.isArray(value)
            ? (value.length > 0 ? `✅ ${value[0]}` : '⚪ []')
            : (value ? `✅ ${value}` : '❌');
          console.log(`  ${field.padEnd(15)}: ${display}`);
        } else {
          console.log(`  ${field.padEnd(15)}: ❌ campo não existe`);
        }
      });

      if (!hasSocialFields) {
        console.log('\n⚠️  NENHUM campo de social media encontrado!');
        console.log('Isso indica que o actor NÃO está configurado para capturar redes sociais.\n');
      }

      console.log('\n🔑 Todos os campos disponíveis:');
      console.log('='.repeat(80));
      const fields = Object.keys(first).sort();
      console.log(fields.join(', '));

      // Contar resultados com social media
      let withSocial = 0;
      dataset.items.forEach((item: any) => {
        const has = socialFields.some(field => {
          const value = item[field];
          return Array.isArray(value) ? value.length > 0 : !!value;
        });
        if (has) withSocial++;
      });

      console.log(`\n\n📊 Resumo: ${withSocial}/${dataset.items.length} resultados com redes sociais`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkApifyData();
