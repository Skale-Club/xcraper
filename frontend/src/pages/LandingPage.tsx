import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { settingsApi } from '@/lib/api';
import {
    Search,
    MapPin,
    Phone,
    Mail,
    Database,
    Zap,
    Shield,
    CheckCircle,
    ArrowRight,
    Star,
    Users,
    TrendingUp,
    Menu,
    X,
} from 'lucide-react';
import { useState } from 'react';

interface PublicSettings {
    brandName: string;
    brandTagline: string;
    brandDescription: string;
    logoUrl?: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    ogImageUrl?: string;
    heroTitle: string;
    heroSubtitle: string;
    heroCtaText: string;
    featuresTitle: string;
    featuresSubtitle: string;
    pricingTitle: string;
    pricingSubtitle: string;
    faqTitle: string;
    faqContent: Array<{ question: string; answer: string }>;
    testimonialsEnabled: boolean;
    testimonialsContent: Array<{
        name: string;
        role: string;
        company: string;
        content: string;
        avatar?: string;
    }>;
    footerText: string;
    footerLinks: Array<{ label: string; url: string }>;
    socialLinks: Array<{ platform: string; url: string }>;
    registrationEnabled: boolean;
    freeCreditsOnSignup: number;
}

interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    price: string;
    description?: string;
    isPopular: boolean;
}

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // Fetch public settings
    const { data, isLoading } = useQuery({
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
    };

    const packages: CreditPackage[] = data?.packages ?? [];

    // Update document title and meta tags for SEO
    useEffect(() => {
        if (settings) {
            document.title = settings.seoTitle;

            // Update meta description
            let metaDescription = document.querySelector('meta[name="description"]');
            if (!metaDescription) {
                metaDescription = document.createElement('meta');
                metaDescription.setAttribute('name', 'description');
                document.head.appendChild(metaDescription);
            }
            metaDescription.setAttribute('content', settings.seoDescription);

            // Update meta keywords
            let metaKeywords = document.querySelector('meta[name="keywords"]');
            if (!metaKeywords) {
                metaKeywords = document.createElement('meta');
                metaKeywords.setAttribute('name', 'keywords');
                document.head.appendChild(metaKeywords);
            }
            metaKeywords.setAttribute('content', settings.seoKeywords);

            // Update OG tags
            const updateMeta = (property: string, content: string) => {
                let meta = document.querySelector(`meta[property="${property}"]`);
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('property', property);
                    document.head.appendChild(meta);
                }
                meta.setAttribute('content', content);
            };

            updateMeta('og:title', settings.seoTitle);
            updateMeta('og:description', settings.seoDescription);
            if (settings.ogImageUrl) {
                updateMeta('og:image', settings.ogImageUrl);
            }
            updateMeta('og:type', 'website');

            // Twitter card
            let twitterCard = document.querySelector('meta[name="twitter:card"]');
            if (!twitterCard) {
                twitterCard = document.createElement('meta');
                twitterCard.setAttribute('name', 'twitter:card');
                document.head.appendChild(twitterCard);
            }
            twitterCard.setAttribute('content', 'summary_large_image');
        }
    }, [settings]);

    const features = [
        {
            icon: Search,
            title: 'Google Maps Scraping',
            description: 'Extract business data from Google Maps with precision and speed.',
        },
        {
            icon: Mail,
            title: 'Email Extraction',
            description: 'Automatically find and extract email addresses from business listings.',
        },
        {
            icon: Phone,
            title: 'Phone Numbers',
            description: 'Get verified phone numbers for direct outreach campaigns.',
        },
        {
            icon: Database,
            title: 'Bulk Export',
            description: 'Export your leads in CSV or JSON format for easy integration.',
        },
        {
            icon: Zap,
            title: 'Fast & Reliable',
            description: 'Powered by Apify for enterprise-grade scraping performance.',
        },
        {
            icon: Shield,
            title: 'Secure & Private',
            description: 'Your data is encrypted and never shared with third parties.',
        },
    ];

    const defaultPackages: CreditPackage[] = [
        { id: '1', name: 'Starter', credits: 50, price: '9.99', isPopular: false },
        { id: '2', name: 'Basic', credits: 150, price: '24.99', isPopular: false },
        { id: '3', name: 'Pro', credits: 500, price: '74.99', isPopular: true },
        { id: '4', name: 'Enterprise', credits: 1500, price: '199.99', isPopular: false },
    ];

    const displayPackages = packages.length > 0 ? packages : defaultPackages;

    const defaultFaqs = [
        {
            question: 'How does Xcraper work?',
            answer: 'Xcraper uses the Apify platform to scrape Google Maps for business listings. Simply enter your search query and location, and we\'ll extract all available contact information.',
        },
        {
            question: 'What data can I extract?',
            answer: 'You can extract business names, addresses, phone numbers, websites, emails, ratings, reviews, and geographic coordinates.',
        },
        {
            question: 'How many credits does a search cost?',
            answer: 'Each search costs 1 credit plus 1 credit per contact saved. For example, a search that returns 50 contacts would cost 51 credits total.',
        },
        {
            question: 'Is this legal?',
            answer: 'Yes, we only scrape publicly available business information from Google Maps. This data is freely accessible and can be used for lead generation purposes.',
        },
        {
            question: 'Can I get a refund?',
            answer: 'We offer a 30-day money-back guarantee on all credit purchases. If you\'re not satisfied, contact our support team for a full refund.',
        },
    ];

    const displayFaqs = settings.faqContent?.length > 0 ? settings.faqContent : defaultFaqs;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
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

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
                            <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
                            <a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
                            <Link href="/login">
                                <Button variant="ghost">Login</Button>
                            </Link>
                            {settings.registrationEnabled && (
                                <Link href="/login">
                                    <Button>{settings.heroCtaText}</Button>
                                </Link>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden p-2"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>

                    {/* Mobile Navigation */}
                    {mobileMenuOpen && (
                        <div className="md:hidden py-4 border-t">
                            <div className="flex flex-col gap-4">
                                <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
                                <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
                                <a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a>
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

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                            {settings.heroTitle}
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            {settings.heroSubtitle}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            {settings.registrationEnabled && (
                                <Link href="/login">
                                    <Button size="lg" className="text-lg px-8">
                                        {settings.heroCtaText}
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </Link>
                            )}
                            <p className="text-sm text-gray-500">
                                🎁 Get {settings.freeCreditsOnSignup} free credits on signup
                            </p>
                        </div>
                    </motion.div>

                    {/* Hero Image / Demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-16"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-1">
                            <div className="bg-gray-900 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <div className="p-6">
                                    <div className="flex gap-4 mb-4">
                                        <div className="flex-1 bg-gray-800 rounded-lg p-3">
                                            <div className="text-gray-400 text-sm mb-1">Search</div>
                                            <div className="text-white">Restaurants in New York</div>
                                        </div>
                                        <button className="bg-blue-600 text-white px-6 rounded-lg font-medium">
                                            Scrape
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} className="bg-gray-800 rounded-lg p-4">
                                                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                                                <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
                                                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-y">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { icon: Users, value: '10K+', label: 'Active Users' },
                            { icon: Database, value: '5M+', label: 'Contacts Extracted' },
                            { icon: MapPin, value: '190+', label: 'Countries' },
                            { icon: TrendingUp, value: '99.9%', label: 'Uptime' },
                        ].map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="text-center"
                            >
                                <stat.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                                <div className="text-gray-500">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-4 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            {settings.featuresTitle}
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            {settings.featuresSubtitle}
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="h-full hover:shadow-lg transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                            <feature.icon className="w-6 h-6 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                                        <p className="text-gray-600">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 px-4 bg-white">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            {settings.pricingTitle}
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            {settings.pricingSubtitle}
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {displayPackages.map((pkg, index) => (
                            <motion.div
                                key={pkg.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className={`h-full relative ${pkg.isPopular ? 'border-primary border-2' : ''}`}>
                                    {pkg.isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full">
                                                Most Popular
                                            </span>
                                        </div>
                                    )}
                                    <CardHeader className="text-center">
                                        <CardTitle>{pkg.name}</CardTitle>
                                        <div className="mt-4">
                                            <span className="text-4xl font-bold">${pkg.price}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                        <p className="text-2xl font-bold text-primary mb-4">{pkg.credits} credits</p>
                                        <p className="text-sm text-gray-500 mb-6">
                                            ${(parseFloat(pkg.price) / pkg.credits).toFixed(3)} per credit
                                        </p>
                                        <ul className="space-y-2 text-left mb-6">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <span className="text-sm">{pkg.credits} contact extractions</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <span className="text-sm">CSV/JSON export</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                <span className="text-sm">Email support</span>
                                            </li>
                                        </ul>
                                        <Link href="/login" className="block">
                                            <Button className="w-full" variant={pkg.isPopular ? 'default' : 'outline'}>
                                                Get Started
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            {settings.testimonialsEnabled && settings.testimonialsContent?.length > 0 && (
                <section className="py-20 px-4 bg-gray-50">
                    <div className="max-w-7xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                What Our Customers Say
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {settings.testimonialsContent.map((testimonial, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card>
                                        <CardContent className="p-6">
                                            <div className="flex gap-1 mb-4">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                                ))}
                                            </div>
                                            <p className="text-gray-600 mb-4">"{testimonial.content}"</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                                    {testimonial.avatar ? (
                                                        <img src={testimonial.avatar} alt="" className="w-10 h-10 rounded-full" />
                                                    ) : (
                                                        <span className="text-sm font-medium">
                                                            {testimonial.name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{testimonial.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {testimonial.role} at {testimonial.company}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* FAQ Section */}
            <section id="faq" className="py-20 px-4 bg-white">
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            {settings.faqTitle}
                        </h2>
                    </motion.div>

                    <div className="space-y-4">
                        {displayFaqs.map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="cursor-pointer" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-semibold">{faq.question}</h3>
                                            <span className="text-2xl">{openFaq === index ? '−' : '+'}</span>
                                        </div>
                                        {openFaq === index && (
                                            <p className="mt-4 text-gray-600">{faq.answer}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Ready to Start Extracting Leads?
                        </h2>
                        <p className="text-xl text-blue-100 mb-8">
                            Join thousands of businesses using {settings.brandName} to grow their customer base.
                        </p>
                        {settings.registrationEnabled && (
                            <Link href="/login">
                                <Button size="lg" variant="secondary" className="text-lg px-8">
                                    {settings.heroCtaText}
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                        )}
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
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
                                <li><a href="#features" className="hover:text-white">Features</a></li>
                                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                {settings.footerLinks?.map((link, index) => (
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
                        {settings.footerText}
                    </div>
                </div>
            </footer>
        </div>
    );
}
