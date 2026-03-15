import { db } from '../db/index.js';
import { settings, creditPackages } from '../db/schema.js';

async function seedSettings() {
    console.log('Seeding default settings...');

    // Check if settings already exist
    const existingSettings = await db.select().from(settings).limit(1);

    if (existingSettings.length === 0) {
        // Insert default settings
        const defaultSettings: typeof settings.$inferInsert = {
            id: 'default',
            brandName: 'Xcraper',
            brandTagline: 'Extract Business Contacts from Google Maps',
            brandDescription: 'The most powerful Google Maps scraping tool for lead generation. Extract phone numbers, emails, addresses, and more from millions of businesses worldwide.',
            seoTitle: 'Xcraper - Google Maps Contact Scraper | Lead Generation Tool',
            seoDescription: 'Extract business contacts from Google Maps with Xcraper. Get phone numbers, emails, addresses and more. Perfect for lead generation and sales teams.',
            seoKeywords: 'google maps scraper, lead generation, business contacts, email extractor, phone number scraper, b2b leads, sales leads',
            heroTitle: 'Extract Business Leads from Google Maps',
            heroSubtitle: 'Get phone numbers, emails, addresses, and social media links from millions of businesses worldwide. Start with 10 free credits.',
            heroCtaText: 'Start Free Trial',
            featuresTitle: 'Powerful Features',
            featuresSubtitle: 'Everything you need to generate high-quality leads',
            pricingTitle: 'Simple, Credit-Based Pricing',
            pricingSubtitle: 'Pay only for what you use. No subscriptions, no hidden fees.',
            faqTitle: 'Frequently Asked Questions',
            faqContent: [
                {
                    question: 'How does the credit system work?',
                    answer: 'Each search costs 1 credit, and saving each contact costs 1 additional credit. For example, searching for "restaurants in New York" and saving 50 contacts would cost 51 credits total.'
                },
                {
                    question: 'What data can I extract?',
                    answer: 'You can extract business names, phone numbers, emails, addresses, websites, opening hours, ratings, review counts, and social media links when available.'
                },
                {
                    question: 'Is this legal?',
                    answer: 'Yes, we only extract publicly available business information from Google Maps. This is the same information anyone can manually copy from Google Maps listings.'
                },
                {
                    question: 'Can I export the contacts?',
                    answer: 'Yes, you can export all your saved contacts to CSV or JSON format for easy integration with your CRM or email marketing tools.'
                },
                {
                    question: 'Do credits expire?',
                    answer: 'No, your purchased credits never expire. Use them whenever you need them.'
                }
            ],
            testimonialsEnabled: true,
            testimonialsContent: [
                {
                    name: 'Sarah Johnson',
                    role: 'Sales Director',
                    company: 'TechCorp Inc.',
                    content: 'Xcraper has transformed our lead generation process. We went from spending hours manually searching for contacts to getting thousands of qualified leads in minutes.',
                    avatar: undefined
                },
                {
                    name: 'Michael Chen',
                    role: 'Marketing Manager',
                    company: 'Growth Agency',
                    content: 'The accuracy of the data is impressive. We\'ve seen a 40% increase in our outreach response rates since using Xcraper.',
                    avatar: undefined
                },
                {
                    name: 'Emily Rodriguez',
                    company: 'Local Services Co.',
                    role: 'Business Development',
                    content: 'Simple, fast, and affordable. Xcraper is exactly what we needed to scale our B2B outreach without breaking the bank.',
                    avatar: undefined
                }
            ],
            footerText: '© 2024 Xcraper. All rights reserved.',
            footerLinks: [
                { label: 'Privacy Policy', url: '/privacy' },
                { label: 'Terms of Service', url: '/terms' },
                { label: 'Contact', url: 'mailto:support@xcraper.com' }
            ],
            socialLinks: [
                { platform: 'twitter', url: 'https://twitter.com/xcraper' },
                { platform: 'linkedin', url: 'https://linkedin.com/company/xcraper' }
            ],
            registrationEnabled: true,
            freeCreditsOnSignup: 10,
            creditsPerStandardResult: 1,
            creditsPerEnrichedResult: 3,
        };
        await db.insert(settings).values(defaultSettings);
        console.log('✓ Default settings inserted');
    } else {
        console.log('✓ Settings already exist, skipping');
    }

    // Check if credit packages already exist
    const existingPackages = await db.select().from(creditPackages).limit(1);

    if (existingPackages.length === 0) {
        // Insert default credit packages
        await db.insert(creditPackages).values([
            {
                name: 'Starter',
                credits: 100,
                price: '9.99',
                description: 'Perfect for trying out the platform',
                isPopular: false,
                isActive: true,
                sortOrder: 1,
            },
            {
                name: 'Professional',
                credits: 500,
                price: '39.99',
                description: 'Great for small teams and agencies',
                isPopular: true,
                isActive: true,
                sortOrder: 2,
            },
            {
                name: 'Business',
                credits: 1500,
                price: '99.99',
                description: 'Ideal for growing businesses',
                isPopular: false,
                isActive: true,
                sortOrder: 3,
            },
            {
                name: 'Enterprise',
                credits: 5000,
                price: '249.99',
                description: 'For large-scale lead generation',
                isPopular: false,
                isActive: true,
                sortOrder: 4,
            },
        ]);
        console.log('✓ Default credit packages inserted');
    } else {
        console.log('✓ Credit packages already exist, skipping');
    }

    console.log('\nSeeding complete!');
    process.exit(0);
}

seedSettings().catch((error) => {
    console.error('Error seeding settings:', error);
    process.exit(1);
});
