import { db } from '../db';
import { searchHistory, contacts } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

async function checkChiropractorSearch() {
  try {
    console.log('🔍 Procurando buscas de "chiropractor"...\n');

    const searches = await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.query, 'chiropractor'))
      .orderBy(desc(searchHistory.createdAt));

    console.log(`📊 Encontradas ${searches.length} buscas:\n`);

    for (const search of searches) {
      console.log('='.repeat(80));
      console.log(`ID: ${search.id}`);
      console.log(`Location: ${search.location}`);
      console.log(`Total Results: ${search.totalResults}`);
      console.log(`Created: ${search.createdAt}`);
      console.log(`Apify Run: ${search.apifyRunId}`);

      // Verificar contatos desta busca
      const searchContacts = await db.select()
        .from(contacts)
        .where(eq(contacts.searchId, search.id))
        .limit(5);

      console.log(`\n📇 Contatos desta busca: ${searchContacts.length}`);

      if (searchContacts.length > 0) {
        console.log('\nPrimeiro contato:');
        const first = searchContacts[0];
        console.log(`  Nome: ${first.title}`);
        console.log(`  Facebook: ${first.facebook || '❌ não tem'}`);
        console.log(`  Instagram: ${first.instagram || '❌ não tem'}`);
        console.log(`  Twitter: ${first.twitter || '❌ não tem'}`);
        console.log(`  LinkedIn: ${first.linkedin || '❌ não tem'}`);
        console.log(`  YouTube: ${first.youtube || '❌ não tem'}`);

        const hasSocial = first.facebook || first.instagram || first.twitter ||
                         first.linkedin || first.youtube || first.tiktok || first.pinterest;

        console.log(`\n  Tem redes sociais? ${hasSocial ? '✅ SIM' : '❌ NÃO'}`);

        // Contar quantos têm redes sociais
        const allContacts = await db.select()
          .from(contacts)
          .where(eq(contacts.searchId, search.id));

        const withSocial = allContacts.filter(c =>
          c.facebook || c.instagram || c.twitter || c.linkedin ||
          c.youtube || c.tiktok || c.pinterest
        ).length;

        console.log(`\n📊 Resumo: ${withSocial}/${allContacts.length} contatos têm redes sociais (${((withSocial/allContacts.length)*100).toFixed(1)}%)`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkChiropractorSearch();
