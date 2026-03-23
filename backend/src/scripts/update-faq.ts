import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function updateFaq() {
    console.log('Updating FAQ in database...');

    const newFaqs = [
        {
            question: 'How accurate is the extraction process?',
            answer: 'We pull data directly from Google Maps in real-time, ensuring you get the most up-to-date business information. Our AI enrichment then verifies emails and social profiles to maintain high delivery rates.',
        },
        {
            question: 'What exactly is a "Credit"?',
            answer: 'One credit represents one fully enriched business lead (including verified emails and social links). We only charge for successful extractions, ensuring you get maximum value for your investment.',
        },
        {
            question: 'Can I export the leads to my CRM?',
            answer: 'Yes! You can export your data in CSV format, perfectly structured to be imported directly into HubSpot, Salesforce, Pipedrive, or any other CRM of your choice.',
        },
        {
            question: 'Does Xcraper find private email addresses?',
            answer: 'We use advanced AI to discover and verify official business emails and public professional contacts associated with the business profiles, complying with public data access standards.',
        },
        {
            question: 'How do the monthly credits work?',
            answer: 'Your plan provides a set amount of credits each month. If you need more, you can upgrade your plan or purchase top-up packages at any time from your dashboard.',
        },
    ];

    await db.update(settings)
        .set({ 
            faqContent: newFaqs,
            updatedAt: new Date() 
        })
        .where(eq(settings.id, 'default'));

    console.log('✓ FAQ updated successfully in database!');
    process.exit(0);
}

updateFaq().catch((error) => {
    console.error('Error updating FAQ:', error);
    process.exit(1);
});
