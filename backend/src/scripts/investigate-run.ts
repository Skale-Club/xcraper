import { db } from '../db';
import { searchHistory, contacts } from '../db/schema';
import { eq } from 'drizzle-orm';

const searchId = 'a8ae6028-3c3e-43d0-94ef-833cc9452855';

async function investigateRun() {
  try {
    console.log('🔍 Investigando search:', searchId, '\n');

    // Buscar a pesquisa
    const search = await db.query.searchHistory.findFirst({
      where: eq(searchHistory.id, searchId),
    });

    if (!search) {
      console.log('❌ Search não encontrada no banco de dados');
      return;
    }

    console.log('✅ Search Encontrada:');
    console.log('='.repeat(80));
    console.log('Query:', search.query);
    console.log('Location:', search.location);
    console.log('Status:', search.status);
    console.log('Total Results:', search.totalResults);
    console.log('Created:', search.createdAt);
    console.log('Completed:', search.completedAt);
    console.log('Apify Run ID:', search.apifyRunId);
    console.log('Apify Actor:', search.apifyActorName || search.apifyActorId);

    // Buscar contatos
    const searchContacts = await db.select()
      .from(contacts)
      .where(eq(contacts.searchId, searchId));

    console.log('\n📇 Contatos:');
    console.log('='.repeat(80));
    console.log(`Total: ${searchContacts.length}`);

    if (searchContacts.length === 0) {
      console.log('⚠️  Nenhum contato salvo ainda!');
      console.log('\nPossíveis motivos:');
      console.log('  1. Search ainda está em andamento (status:', search.status + ')');
      console.log('  2. Erro ao salvar os contatos');
      console.log('  3. Nenhum resultado encontrado');
      return;
    }

    // Analisar primeiros 3 contatos
    console.log('\n🔍 Analisando primeiros contatos:\n');

    searchContacts.slice(0, 3).forEach((contact, idx) => {
      console.log(`${idx + 1}. ${contact.title}`);
      console.log('   Category:', contact.category || 'N/A');
      console.log('   Phone:', contact.phone || 'N/A');

      console.log('\n   📱 Social Media:');
      console.log('   Facebook:', contact.facebook || '❌');
      console.log('   Instagram:', contact.instagram || '❌');
      console.log('   Twitter:', contact.twitter || '❌');
      console.log('   LinkedIn:', contact.linkedin || '❌');
      console.log('   YouTube:', contact.youtube || '❌');
      console.log('   TikTok:', contact.tiktok || '❌');
      console.log('   Pinterest:', contact.pinterest || '❌');

      // Verificar rawData
      if (contact.rawData) {
        const raw = contact.rawData as any;
        console.log('\n   🔍 RawData tem redes sociais?');
        if (raw.facebooks && Array.isArray(raw.facebooks)) {
          console.log('   facebooks array:', raw.facebooks.length > 0 ? `✅ ${raw.facebooks[0]}` : '❌ vazio');
        }
        if (raw.instagrams && Array.isArray(raw.instagrams)) {
          console.log('   instagrams array:', raw.instagrams.length > 0 ? `✅ ${raw.instagrams[0]}` : '❌ vazio');
        }
        if (raw.youtubes && Array.isArray(raw.youtubes)) {
          console.log('   youtubes array:', raw.youtubes.length > 0 ? `✅ ${raw.youtubes[0]}` : '❌ vazio');
        }
      }

      console.log('\n' + '-'.repeat(80) + '\n');
    });

    // Estatísticas
    const withSocial = searchContacts.filter(c =>
      c.facebook || c.instagram || c.twitter || c.linkedin ||
      c.youtube || c.tiktok || c.pinterest
    );

    const withSocialInRaw = searchContacts.filter(c => {
      if (!c.rawData) return false;
      const raw = c.rawData as any;
      return (
        (Array.isArray(raw.facebooks) && raw.facebooks.length > 0) ||
        (Array.isArray(raw.instagrams) && raw.instagrams.length > 0) ||
        (Array.isArray(raw.youtubes) && raw.youtubes.length > 0) ||
        (Array.isArray(raw.linkedIns) && raw.linkedIns.length > 0) ||
        (Array.isArray(raw.twitters) && raw.twitters.length > 0)
      );
    });

    console.log('📊 Estatísticas:');
    console.log('='.repeat(80));
    console.log(`Contatos com social media nos CAMPOS: ${withSocial.length}/${searchContacts.length} (${((withSocial.length/searchContacts.length)*100).toFixed(1)}%)`);
    console.log(`Contatos com social media no RAW_DATA: ${withSocialInRaw.length}/${searchContacts.length} (${((withSocialInRaw.length/searchContacts.length)*100).toFixed(1)}%)`);

    if (withSocialInRaw.length > 0 && withSocial.length === 0) {
      console.log('\n⚠️  PROBLEMA DETECTADO:');
      console.log('Os dados de redes sociais estão no rawData mas NÃO foram extraídos para os campos!');
      console.log('Isso significa que a função extractSocialMediaFromRawData() não está sendo executada.');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

investigateRun();
