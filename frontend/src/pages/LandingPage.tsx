import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { settingsApi, subscriptionApi } from '@/lib/api';
import {
    Search,
    Shield,
    CheckCircle,
    ArrowRight,
    Star,
    Menu,
    X,
    ChevronDown,
} from 'lucide-react';

interface PublicSettings {
    brandName: string;
    brandTagline: string;
    brandDescription: string;
    logoUrl?: string;
    faviconUrl?: string;
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


export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const { data: settingsData, isLoading: settingsLoading } = useQuery({
        queryKey: ['public-settings'],
        queryFn: () => settingsApi.getPublic(),
    });

    const { data: plansData, isLoading: plansLoading } = useQuery({
        queryKey: ['public-plans'],
        queryFn: () => subscriptionApi.getPublicPlans(),
    });

    const isLoading = settingsLoading || plansLoading;

    const settings: PublicSettings = settingsData?.settings ?? {
        brandName: 'Xcraper',
        brandTagline: 'Extract Business Contacts from Google Maps',
        brandDescription: 'The most powerful Google Maps scraping tool for lead generation.',
        seoTitle: 'Xcraper - Google Maps Contact Scraper',
        seoDescription: 'Extract business contacts, emails, phone numbers from Google Maps.',
        seoKeywords: 'google maps scraper, lead generation, business contacts',
        heroTitle: 'Turn Google Maps Into Your Lead Machine',
        heroSubtitle: 'Extract verified phone numbers, emails, and social profiles from millions of businesses worldwide in minutes.',
        heroCtaText: 'Start Scraping Free',
        featuresTitle: 'Everything You Need to Scale Your Outreach',
        featuresSubtitle: 'Powerful tools designed for precision lead generation and data enrichment.',
        pricingTitle: 'Simple, Transparent Pricing',
        pricingSubtitle: 'Choose the plan that fits your growth needs.',
        faqTitle: 'Frequently Asked Questions',
        faqContent: [],
        testimonialsEnabled: true,
        testimonialsContent: [],
        footerText: '© 2024 Xcraper. All rights reserved.',
        footerLinks: [],
        socialLinks: [],
        registrationEnabled: true,
        freeCreditsOnSignup: 10,
    };
    const footerText = settings.footerText.replace(/©\s*\d{4}/, `© ${currentYear}`);

    useEffect(() => {
        if (!settingsData?.settings) {
            return;
        }

        const nextSettings = settingsData.settings;
        document.title = nextSettings.seoTitle;

        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
        }
        metaDescription.setAttribute('content', nextSettings.seoDescription);

        const updateMeta = (property: string, content: string) => {
            let meta = document.querySelector(`meta[property="${property}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        };

        updateMeta('og:title', nextSettings.seoTitle);
        updateMeta('og:description', nextSettings.seoDescription);
        if (nextSettings.ogImageUrl) {
            updateMeta('og:image', nextSettings.ogImageUrl);
        }
        updateMeta('og:type', 'website');
    }, [settingsData]);

    const displayPlans = plansData?.plans ?? [];

    const defaultFaqs = [
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

    const displayFaqs = settings.faqContent?.length > 0 ? settings.faqContent : defaultFaqs;
    const displayTestimonials = settings.testimonialsContent?.length > 0
        ? settings.testimonialsContent
        : [
            { 
                name: 'Alex Rivera', 
                role: 'Head of Sales', 
                company: 'GrowthScale', 
                content: 'Xcraper changed our outbound game. We went from 10 leads a day to 500+.',
                avatar: 'https://i.pravatar.cc/150?u=alex'
            },
            { 
                name: 'Sarah Chen', 
                role: 'Founder', 
                company: 'Chen Agency', 
                content: 'The email enrichment is magic. Most scrapers only give you phone numbers, but Xcraper gives us everything.',
                avatar: 'https://i.pravatar.cc/150?u=sarah'
            },
            { 
                name: 'Marc Dupont', 
                role: 'Marketing Manager', 
                company: 'Global Reach', 
                content: 'Cleanest UI and fastest extraction I\'ve used. The CSV exports are perfectly formatted for our CRM.',
                avatar: 'https://i.pravatar.cc/150?u=marc'
            },
        ];

    const displayFooterLinks = settings.footerLinks?.length > 0
        ? settings.footerLinks
        : [
            { label: 'Privacy', url: '/privacy' },
            { label: 'Terms', url: '/terms' },
            { label: 'Pricing', url: '#pricing' },
        ];
    const brandMark = settings.logoUrl || settings.faviconUrl || '/favicon.png';

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-ping absolute"></div>
                    <div className="h-16 w-16 rounded-full border-4 border-t-primary animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-primary selection:text-white">
            {/* Background Ornaments */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-slate-950/70 backdrop-blur-xl py-3' : 'bg-transparent py-5'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <img src={brandMark} alt={settings.brandName} className="w-10 h-10 rounded-xl shadow-lg group-hover:rotate-6 transition-transform" />
                            <span className="text-2xl font-bold tracking-tight font-heading">
                                {settings.brandName}
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-10">
                            <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-primary transition-colors">Pricing</a>
                            <a href="#faq" className="text-sm font-medium text-slate-400 hover:text-primary transition-colors">FAQ</a>
                            <div className="h-4 w-px bg-slate-800 mx-2"></div>
                            <Link href="/login">
                                <button className="text-sm font-semibold text-slate-300 hover:text-primary transition-colors">Login</button>
                            </Link>
                            {settings.registrationEnabled && (
                                <Link href="/login">
                                    <Button className="rounded-full px-6 shadow-lg shadow-primary/20">
                                        Get Started
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden p-2 rounded-lg bg-slate-800"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden mt-3 bg-slate-900 border-b border-slate-800 overflow-hidden"
                        >
                            <div className="px-4 pt-8 pb-6 flex flex-col gap-6">
                                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">Pricing</a>
                                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium">FAQ</a>
                                <Link href="/login">
                                    <Button variant="outline" className="w-full rounded-xl">Login</Button>
                                </Link>
                                {settings.registrationEnabled && (
                                    <Link href="/login">
                                        <Button className="w-full rounded-xl">{settings.heroCtaText}</Button>
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            <main className="relative z-10">
                {/* Hero Section */}
                <section className="pt-32 pb-10 md:pb-16 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        >
                            <Badge variant="outline" className="mb-6 py-1 px-4 rounded-full bg-primary/5 text-primary border-primary/20 animate-bounce">
                                New: AI-Powered Email Enrichment
                            </Badge>
                            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] font-heading">
                                {settings.heroTitle.split(' ').map((word, i) => (
                                    <span key={i} className={i >= settings.heroTitle.split(' ').length - 2 ? 'text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400' : ''}>
                                        {word}{' '}
                                    </span>
                                ))}
                            </h1>
                            <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
                                {settings.heroSubtitle}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-7 sm:gap-4 items-start sm:items-center">
                                {settings.registrationEnabled && (
                                    <Link href="/login" className="w-full sm:w-auto">
                                        <Button size="lg" className="h-14 w-full sm:w-auto px-10 text-lg rounded-2xl shadow-xl shadow-primary/20 transition-transform hover:scale-105 active:scale-95">
                                            {settings.heroCtaText}
                                            <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </Link>
                                )}
                                <div className="flex -space-x-2 items-center self-start">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 aspect-square shrink-0 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                                            <img
                                                src={`https://i.pravatar.cc/100?u=${i + 10}`}
                                                alt="User"
                                                className="block w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                    <div className="pl-6 text-sm text-slate-500 font-medium">
                                        Trusted by <span className="text-white font-bold">growing teams</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                            className="relative lg:block lg:pr-10"
                        >
                            {/* Visual Demo Visualizer */}
                            <div className="relative bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border border-slate-800/50 backdrop-blur-sm">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-primary/30 to-indigo-600/30 rounded-[2.6rem] blur-xl opacity-50 -z-10 animate-pulse"></div>
                                
                                <div className="bg-slate-800 rounded-[1.8rem] overflow-hidden border border-slate-700">
                                    {/* Mock Browser Header */}
                                    <div className="flex items-center gap-2 px-6 py-4 bg-slate-700/50 border-b border-slate-600/50">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                        </div>
                                        <div className="flex-1 ml-4 h-7 bg-slate-900/50 rounded-lg flex items-center px-3 text-[10px] text-slate-500 font-mono">
                                            xcraper.skale.club/app/search
                                        </div>
                                    </div>

                                    {/* Mock Content */}
                                    <div className="p-8">
                                        <div className="space-y-6">
                                            <div className="flex gap-3">
                                                <div className="flex-1 h-12 bg-slate-700/50 rounded-xl border border-slate-600/50 flex items-center px-4 gap-3">
                                                    <Search className="w-4 h-4 text-slate-500" />
                                                    <div className="text-sm text-slate-300">Coffee shops in San Francisco</div>
                                                </div>
                                                <div className="w-32 h-12 bg-primary rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-primary/20">
                                                    Scrape
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.5 + (i * 0.1) }}
                                                        className="p-4 bg-slate-700/30 rounded-2xl border border-slate-600/30"
                                                    >
                                                        <div className="h-2 w-20 bg-slate-600 rounded-full mb-3"></div>
                                                        <div className="h-1.5 w-full bg-slate-600/50 rounded-full mb-2"></div>
                                                        <div className="h-1.5 w-2/3 bg-slate-600/50 rounded-full mb-4"></div>
                                                        <div className="flex gap-2">
                                                            <div className="h-4 w-12 bg-green-500/20 rounded-full border border-green-500/30"></div>
                                                            <div className="h-4 w-16 bg-blue-500/20 rounded-full border border-blue-500/30"></div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* Progress Bar Animation */}
                                            <div className="pt-4">
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-2 uppercase tracking-widest">
                                                    <span>Extracting Contacts...</span>
                                                    <span>84%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: '0%' }}
                                                        animate={{ width: '84%' }}
                                                        transition={{ duration: 2, repeat: Infinity, repeatType: 'loop', repeatDelay: 1 }}
                                                        className="h-full bg-gradient-to-r from-primary to-indigo-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Action Tooltip */}
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute -right-4 top-1/2 bg-slate-800 px-3 py-3 rounded-2xl shadow-2xl border border-slate-700 hidden sm:block"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Status</p>
                                            <p className="text-xs font-bold text-white">1,240 leads found</p>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Pricing Section */}
                {displayPlans.length > 0 && (
                <section id="pricing" className="pt-16 pb-24 md:py-32 bg-slate-950 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center mb-20">
                            <Badge variant="outline" className="mb-4 py-1 px-4 rounded-full bg-primary/10 text-primary border-primary/20 font-semibold tracking-wide uppercase text-[10px]">
                                Transparent Pricing
                            </Badge>
                            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight font-heading">
                                {settings.pricingTitle}
                            </h2>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                {settings.pricingSubtitle}
                            </p>
                        </div>

                        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(displayPlans.length, 3)} lg:grid-cols-${Math.min(displayPlans.length, 4)} gap-8 ${displayPlans.length === 1 ? 'max-w-md mx-auto' : ''}`}>
                            {displayPlans.map((plan, index) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                    className="relative group h-full"
                                >
                                    {/* Advanced Glow effect for popular plans */}
                                    {(plan.isPopular || displayPlans.length === 1) && (
                                        <div className="absolute -inset-[2px] bg-gradient-to-b from-primary/50 via-indigo-500/50 to-purple-600/50 rounded-[2.5rem] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity duration-500"></div>
                                    )}

                                    <div className={`relative h-full flex flex-col p-10 rounded-[2.4rem] border transition-all duration-500 ${
                                        plan.isPopular || displayPlans.length === 1
                                            ? 'bg-slate-900/90 border-white/10 backdrop-blur-xl shadow-2xl shadow-primary/10'
                                            : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-900/60'
                                    }`}>
                                        {/* Popular Badge */}
                                        {(plan.isPopular || displayPlans.length === 1) && (
                                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                                                <div className="bg-gradient-to-r from-primary to-indigo-600 text-white text-[10px] font-black px-6 py-2 rounded-full shadow-xl uppercase tracking-tighter">
                                                    Most Popular
                                                </div>
                                            </div>
                                        )}

                                        {/* Plan Name & Price */}
                                        <div className="mb-10 text-center">
                                            <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-6">{plan.name}</h3>
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-start">
                                                    <span className="text-2xl font-bold mt-2 mr-1 text-slate-500">$</span>
                                                    <span className="text-7xl font-black text-white tracking-tighter">{plan.price}</span>
                                                </div>
                                                <span className="text-sm text-slate-500 font-medium">per month / billed monthly</span>
                                            </div>
                                        </div>

                                        {/* Credits Visualizer Box */}
                                        <div className={`relative overflow-hidden rounded-3xl p-6 mb-10 text-center transition-transform group-hover:scale-[1.02] duration-500 ${
                                            plan.isPopular || displayPlans.length === 1
                                                ? 'bg-gradient-to-br from-primary/10 to-transparent border border-primary/20'
                                                : 'bg-slate-800/30 border border-slate-700/50'
                                        }`}>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Power</div>
                                            <div className="text-4xl font-black text-white mb-1 font-heading">{plan.monthlyCredits.toLocaleString()}</div>
                                            <div className="text-[10px] text-primary font-black uppercase tracking-tighter">Verified Credits</div>
                                            
                                            {/* Decorative background element for credits */}
                                            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl"></div>
                                        </div>

                                        {/* Features List */}
                                        <div className="flex-1 space-y-5 mb-10">
                                            {[
                                                { label: `${plan.monthlyCredits.toLocaleString()} Target Leads`, active: true },
                                                { label: 'AI Email Discovery', active: true },
                                                { label: 'Social Profile Extraction', active: true },
                                                { label: 'Cloud-Sync Search History', active: Number(plan.price) > 0 },
                                                { label: 'Priority API Access', active: plan.isPopular },
                                            ].map((feature, i) => (
                                                <li key={i} className={`flex items-center gap-4 text-sm list-none transition-opacity ${feature.active ? 'text-slate-200' : 'text-slate-600 opacity-50'}`}>
                                                    <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                                                        feature.active 
                                                            ? 'bg-primary/10 text-primary border border-primary/20' 
                                                            : 'bg-slate-800 text-slate-600 border border-slate-700'
                                                    }`}>
                                                        {feature.active ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                                                    </div>
                                                    <span className="font-medium">{feature.label}</span>
                                                </li>
                                            ))}
                                        </div>

                                        {/* CTA Button */}
                                        <Link href="/login" className="block">
                                            <Button
                                                className={`w-full h-14 text-base font-black rounded-2xl transition-all duration-300 ${
                                                    plan.isPopular || displayPlans.length === 1
                                                        ? 'bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1'
                                                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                                                }`}
                                                variant="ghost"
                                            >
                                                Start with {plan.name}
                                            </Button>
                                        </Link>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
                )}

                {/* Testimonials */}
                {settings.testimonialsEnabled && displayTestimonials.length > 0 && (
                <section className="py-32 text-white overflow-hidden relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight font-heading">What our customers say</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {displayTestimonials.map((testimonial, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 relative group hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex gap-1 mb-6">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} className="w-4 h-4 fill-primary text-primary" />
                                        ))}
                                    </div>
                                    <p className="text-xl text-slate-300 mb-8 leading-relaxed italic">
                                        "{testimonial.content}"
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-800 overflow-hidden flex-shrink-0">
                                            <img 
                                                src={testimonial.avatar || `https://i.pravatar.cc/150?u=${testimonial.name}`} 
                                                alt={testimonial.name} 
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg">{testimonial.name}</div>
                                            <div className="text-sm text-slate-500">{testimonial.role} @ {testimonial.company}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
                )}

                {/* FAQ Section */}
                <section id="faq" className="py-32 bg-gradient-to-b from-slate-900 to-slate-950">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <Badge variant="outline" className="mb-4 px-4 py-1 rounded-full bg-primary/5 text-primary border-primary/20">
                                FAQ
                            </Badge>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight font-heading">{settings.faqTitle}</h2>
                            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                                Everything you need to know about the platform.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            {displayFaqs.map((faq, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <div
                                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                                            openFaq === index 
                                                ? 'bg-slate-900 border-primary/30 shadow-xl shadow-primary/5' 
                                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                            className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                    openFaq === index 
                                                        ? 'bg-primary text-white' 
                                                        : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    <span className="text-sm font-bold">{index + 1}</span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                                openFaq === index 
                                                    ? 'bg-primary/10 text-primary rotate-180' 
                                                    : 'bg-slate-800 text-slate-400'
                                            }`}>
                                                <ChevronDown className="w-4 h-4" />
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {openFaq === index && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-6 pb-6">
                                                        <div className="pl-14 border-l-2 border-primary/20 ml-5">
                                                            <p className="text-slate-400 leading-relaxed">
                                                                {faq.answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-24">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary to-indigo-700 p-12 md:p-24 text-center text-white shadow-2xl">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none"></div>
                            
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative z-10"
                            >
                                <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight font-heading">
                                    {settings.brandTagline || "Ready to automate your lead generation?"}
                                </h2>
                                <p className="text-xl text-primary-foreground/80 mb-12 max-w-2xl mx-auto">
                                    {settings.brandDescription || "Start your free trial today and extract your first 10 leads in less than 60 seconds."}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                                    <Link href="/login">
                                        <Button size="lg" variant="secondary" className="h-16 px-12 text-xl font-bold rounded-2xl shadow-2xl transition-transform hover:scale-105 active:scale-95">
                                            {settings.heroCtaText || "Get Started Free"}
                                        </Button>
                                    </Link>
                                    <div className="flex items-center gap-2 text-primary-foreground font-medium">
                                        <Shield className="w-5 h-5" /> No credit card required
                                    </div>
                                </div>
                            </motion.div>

                            {/* Decorative Elements */}
                            <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                            <div className="absolute bottom-10 right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-slate-950 border-t border-slate-900 pt-16 pb-8 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_220px_220px] gap-12 lg:gap-16 items-start">
                    <div className="max-w-md">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <img src={brandMark} alt={settings.brandName} className="w-8 h-8 rounded-lg" />
                            <span className="text-xl font-bold tracking-tight">{settings.brandName}</span>
                        </Link>
                        <p className="text-slate-500 leading-relaxed">
                            {settings.brandDescription}
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-slate-500">Product</h4>
                        <ul className="space-y-3">
                            <li><a href="#pricing" className="text-slate-400 hover:text-primary transition-colors">Pricing</a></li>
                            <li><a href="#faq" className="text-slate-400 hover:text-primary transition-colors">FAQ</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4 uppercase tracking-widest text-xs text-slate-500">Legal</h4>
                        <ul className="space-y-3">
                            {displayFooterLinks.map((link, index) => (
                                <li key={index}>
                                    <Link href={link.url} className="text-slate-400 hover:text-primary transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-900 text-center text-slate-500 text-sm">
                    {footerText}
                </div>
            </footer>
        </div>
    );
}
