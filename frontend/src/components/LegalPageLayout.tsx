import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { settingsApi, type PublicSettings } from '@/lib/api';
import { ArrowRight, Menu, ShieldCheck, X } from 'lucide-react';

interface LegalPageLayoutProps {
    title: string;
    description: string;
    children: ReactNode;
}

export default function LegalPageLayout({
    title,
    description,
    children,
}: LegalPageLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const currentYear = new Date().getFullYear();
    const { data } = useQuery({
        queryKey: ['public-settings'],
        queryFn: () => settingsApi.getPublic(),
    });

    const settings: PublicSettings = data?.settings ?? {
        brandName: 'Xcraper',
        brandTagline: 'Extract Business Contacts from Google Maps',
        brandDescription: 'The most powerful Google Maps scraping tool for lead generation.',
        seoTitle: 'Xcraper - Google Maps Contact Scraper',
        seoDescription: 'Extract business contacts, emails, phone numbers from Google Maps.',
        seoKeywords: 'google maps scraper, lead generation, business contacts',
        heroTitle: 'Extract Business Leads from Google Maps',
        heroSubtitle: 'Get phone numbers, emails, and addresses from millions of businesses worldwide.',
        heroCtaText: 'Start Free Trial',
        featuresTitle: 'Powerful Features',
        featuresSubtitle: 'Everything you need for effective lead generation',
        pricingTitle: 'Simple, Transparent Pricing',
        pricingSubtitle: 'Choose the plan that fits your needs',
        faqTitle: 'Frequently Asked Questions',
        faqContent: [],
        testimonialsEnabled: false,
        testimonialsContent: [],
        footerText: '© 2024 Xcraper. All rights reserved.',
        footerLinks: [],
        socialLinks: [],
        registrationEnabled: true,
        freeCreditsOnSignup: 10,
        creditsPerStandardResult: 1,
        creditsPerEnrichedResult: 3,
    };
    const footerText = settings.footerText.replace(/©\s*\d{4}/, `© ${currentYear}`);

    const displayFooterLinks = settings.footerLinks?.length > 0
        ? settings.footerLinks
        : [
            { label: 'Privacy Policy', url: '/privacy' },
            { label: 'Terms of Service', url: '/terms' },
        ];

    useEffect(() => {
        document.title = `${title} | Xcraper`;

        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
        }
        metaDescription.setAttribute('content', description);
    }, [description, title]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-white/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-2">
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt={settings.brandName} className="h-8" />
                            ) : (
                                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    {settings.brandName}
                                </span>
                            )}
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <a href="/#features" className="text-gray-600 hover:text-gray-900">Features</a>
                            <a href="/#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
                            <a href="/#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
                            <Link href="/login">
                                <Button variant="ghost">Login</Button>
                            </Link>
                            {settings.registrationEnabled && (
                                <Link href="/login">
                                    <Button>{settings.heroCtaText}</Button>
                                </Link>
                            )}
                        </div>

                        <button
                            className="md:hidden p-2"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden py-4 border-t">
                            <div className="flex flex-col gap-4">
                                <a href="/#features" className="text-gray-600 hover:text-gray-900">Features</a>
                                <a href="/#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
                                <a href="/#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
                                <Link href="/login">
                                    <Button variant="ghost" className="w-full">Login</Button>
                                </Link>
                                {settings.registrationEnabled && (
                                    <Link href="/login">
                                        <Button className="w-full">{settings.heroCtaText}</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            <main className="mx-auto max-w-5xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                    <div className="border-b border-slate-100 px-6 py-10 sm:px-10">
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                            {title}
                        </h1>
                        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                            {description}
                        </p>
                    </div>

                    <div className="space-y-10 px-6 py-10 sm:px-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:tracking-tight [&_p]:text-slate-600 [&_p]:leading-7 [&_ul]:space-y-3 [&_ul]:pl-5 [&_ul]:text-slate-600 [&_ul]:leading-7 [&_li]:list-disc">
                        {children}
                    </div>
                </motion.div>
            </main>

            <section className="px-4 pb-16">
                <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-12 text-center sm:px-10">
                    <h2 className="text-3xl font-semibold text-white">
                        Build your lead workflow on top of Xcraper
                    </h2>
                    <p className="mt-4 text-base leading-7 text-blue-100">
                        Create an account, run your first search, and organize business contacts in one place.
                    </p>
                    {settings.registrationEnabled && (
                        <Link href="/login">
                            <Button size="lg" variant="secondary" className="mt-6">
                                {settings.heroCtaText}
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                    )}
                </div>
            </section>

            <footer className="bg-gray-900 text-gray-400 py-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <span className="text-2xl font-bold text-white">{settings.brandName}</span>
                            <p className="mt-2 text-sm">{settings.brandDescription}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/#features" className="hover:text-white">Features</a></li>
                                <li><a href="/#pricing" className="hover:text-white">Pricing</a></li>
                                <li><a href="/#faq" className="hover:text-white">FAQ</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                {displayFooterLinks.map((link, index) => (
                                    <li key={index}>
                                        <a href={link.url} className="hover:text-white">{link.label}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Connect</h4>
                            <div className="flex gap-4">
                                {settings.socialLinks?.map((social, index) => (
                                    <a
                                        key={index}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-white"
                                    >
                                        {social.platform}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-8 text-center text-sm">
                        {footerText}
                    </div>
                </div>
            </footer>
        </div>
    );
}
