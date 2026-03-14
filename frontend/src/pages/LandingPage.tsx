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
    MousePointer2,
} from 'lucide-react';

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


export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [scrolled, setScrolled] = useState(false);

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

    useEffect(() => {
        if (settings) {
            document.title = settings.seoTitle;
            let metaDescription = document.querySelector('meta[name="description"]');
            if (!metaDescription) {
                metaDescription = document.createElement('meta');
                metaDescription.setAttribute('name', 'description');
                document.head.appendChild(metaDescription);
            }
            metaDescription.setAttribute('content', settings.seoDescription);

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
        }
    }, [settings]);

    const displayPlans = plansData?.plans ?? [];

    const defaultFaqs = [
        {
            question: 'How accurate is the data?',
            answer: 'We extract data directly from Google Maps in real-time. For email enrichment, we use proprietary algorithms to verify contact info, ensuring over 95% accuracy.',
        },
        {
            question: 'What is a "Credit"?',
            answer: 'One credit equals one successfully extracted and enriched business contact. We don\'t charge for search results that don\'t have the data you need.',
        },
        {
            question: 'Can I cancel my subscription?',
            answer: 'Absolutely. You can cancel at any time from your dashboard. Your remaining credits will stay in your account until the end of your billing cycle.',
        },
        {
            question: 'Do you offer a free trial?',
            answer: `Yes! Every new account gets ${settings.freeCreditsOnSignup} free credits to test our extraction and enrichment capabilities—no credit card required.`,
        },
    ];

    const displayFaqs = settings.faqContent?.length > 0 ? settings.faqContent : defaultFaqs;
    const displayTestimonials = settings.testimonialsContent?.length > 0
        ? settings.testimonialsContent
        : [
            { name: 'Alex Rivera', role: 'Head of Sales', company: 'GrowthScale', content: 'Xcraper changed our outbound game. We went from 10 leads a day to 500+.' },
            { name: 'Sarah Chen', role: 'Founder', company: 'Chen Agency', content: 'The email enrichment is magic. Most scrapers only give you phone numbers, but Xcraper gives us everything.' },
            { name: 'Marc Dupont', role: 'Marketing Manager', company: 'Global Reach', content: 'Cleanest UI and fastest extraction I\'ve used. The CSV exports are perfectly formatted for our CRM.' },
        ];

    const displayFooterLinks = settings.footerLinks?.length > 0
        ? settings.footerLinks
        : [
            { label: 'Privacy', url: '/privacy' },
            { label: 'Terms', url: '/terms' },
            { label: 'Pricing', url: '#pricing' },
        ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-ping absolute"></div>
                    <div className="h-16 w-16 rounded-full border-4 border-t-primary animate-spin"></div>
                </div>
                <p className="mt-8 text-slate-400 font-medium animate-pulse">Loading experience...</p>
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
                            <img src="/favicon.png" alt="Xcraper" className="w-10 h-10 rounded-xl shadow-lg group-hover:rotate-6 transition-transform" />
                            <span className="text-2xl font-bold tracking-tight">
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
                            className="md:hidden bg-slate-900 border-b border-slate-800 overflow-hidden"
                        >
                            <div className="px-4 py-6 flex flex-col gap-6">
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
                <section className="pt-28 pb-12 px-4 overflow-hidden">
                    <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        >
                            <Badge variant="outline" className="mb-6 py-1 px-4 rounded-full bg-primary/5 text-primary border-primary/20 animate-bounce">
                                New: AI-Powered Email Enrichment
                            </Badge>
                            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
                                {settings.heroTitle.split(' ').map((word, i) => (
                                    <span key={i} className={i >= settings.heroTitle.split(' ').length - 2 ? 'text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400' : ''}>
                                        {word}{' '}
                                    </span>
                                ))}
                            </h1>
                            <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
                                {settings.heroSubtitle}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                {settings.registrationEnabled && (
                                    <Link href="/login">
                                        <Button size="lg" className="h-14 px-10 text-lg rounded-2xl shadow-xl shadow-primary/20 transition-transform hover:scale-105 active:scale-95">
                                            {settings.heroCtaText}
                                            <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </Link>
                                )}
                                <div className="flex -space-x-3 items-center">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                                            <img src={`https://i.pravatar.cc/100?u=${i + 10}`} alt="User" />
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
                            className="relative lg:block"
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
                                            xcraper.io/app/search
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
                                    className="absolute -right-8 top-1/2 bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-700 hidden sm:block"
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
                <section id="pricing" className="py-32 px-4 bg-slate-900/50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                                {settings.pricingTitle}
                            </h2>
                            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                                {settings.pricingSubtitle}
                            </p>
                        </div>

                        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(displayPlans.length, 3)} lg:grid-cols-${Math.min(displayPlans.length, 4)} gap-6 ${displayPlans.length === 1 ? 'max-w-sm mx-auto' : ''}`}>
                            {displayPlans.map((plan, index) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`relative p-6 rounded-xl transition-shadow hover:shadow-xl ${
                                        plan.isPopular || displayPlans.length === 1 
                                            ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                                            : 'bg-slate-800 shadow'
                                    }`}
                                >
                                    {(plan.isPopular || displayPlans.length === 1) && (
                                        <span className="absolute -top-3 right-4 bg-white text-primary text-xs font-bold px-3 py-1 rounded-full shadow">
                                            Popular
                                        </span>
                                    )}
                                    
                                    <div className="mb-6">
                                        <h3 className={`text-sm font-medium mb-2 ${plan.isPopular || displayPlans.length === 1 ? 'text-white/80' : 'text-slate-400'}`}>{plan.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-bold">${plan.price}</span>
                                            <span className={`text-sm ${plan.isPopular || displayPlans.length === 1 ? 'text-white/70' : 'text-slate-400'}`}>/month</span>
                                        </div>
                                    </div>
                                    
                                     <div className={`py-3 px-4 rounded-lg mb-6 ${plan.isPopular || displayPlans.length === 1 ? 'bg-white/20' : 'bg-slate-700'}`}>
                                        <span className="text-xl font-bold">{plan.monthlyCredits}</span>
                                        <span className={`text-sm ${plan.isPopular || displayPlans.length === 1 ? 'text-white/80' : 'text-slate-400'}`}> credits included</span>
                                    </div>
                                    
                                    <ul className="space-y-3 mb-6">
                                        {[
                                            `${plan.monthlyCredits} verified leads`,
                                            'Email enrichment',
                                            'Social profiles',
                                            'Unlimited exports',
                                            'Priority support',
                                        ].map((feature, i) => (
                                            <li key={i} className="flex items-center gap-2 text-sm">
                                                <CheckCircle className="w-4 h-4 shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    
                                    <Link href="/login" className="block">
                                        <Button 
                                            className="w-full"
                                            variant={plan.isPopular || displayPlans.length === 1 ? 'secondary' : 'default'}
                                        >
                                            Get Started
                                        </Button>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
                )}

                {/* Testimonials */}
                {settings.testimonialsEnabled && displayTestimonials.length > 0 && (
                <section className="py-32 px-4 bg-slate-950 text-white overflow-hidden relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
                    
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">What our customers say</h2>
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
                                            {testimonial.avatar ? (
                                                <img src={testimonial.avatar} alt={testimonial.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-300 font-bold">
                                                    {testimonial.name.charAt(0)}
                                                </div>
                                            )}
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
                <section id="faq" className="py-32 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16">
                            <Badge variant="outline" className="mb-4 px-4 py-1 rounded-full bg-primary/5 text-primary border-primary/20">
                                FAQ
                            </Badge>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{settings.faqTitle}</h2>
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
                <section className="py-24 px-4">
                    <div className="max-w-7xl mx-auto">
                        <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary to-indigo-700 p-12 md:p-24 text-center text-white shadow-2xl">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none"></div>
                            
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative z-10"
                            >
                                <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight">
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
            <footer className="bg-slate-950 border-t border-slate-900 py-20 px-4 relative z-10">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-8">
                            <img src="/favicon.png" alt="Xcraper" className="w-8 h-8 rounded-lg" />
                            <span className="text-xl font-bold tracking-tight">{settings.brandName}</span>
                        </Link>
                        <p className="text-slate-500 leading-relaxed mb-8">
                            {settings.brandDescription}
                        </p>
                        <div className="flex gap-4">
                            {settings.socialLinks?.map((social, index) => (
                                <a key={index} href={social.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer" title={social.platform}>
                                    <MousePointer2 className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold mb-8 uppercase tracking-widest text-xs text-slate-500">Product</h4>
                        <ul className="space-y-4">
                            <li><a href="#pricing" className="text-slate-400 hover:text-primary transition-colors">Pricing</a></li>
                            <li><a href="#faq" className="text-slate-400 hover:text-primary transition-colors">Documentation</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-8 uppercase tracking-widest text-xs text-slate-500">Legal</h4>
                        <ul className="space-y-4">
                            {displayFooterLinks.map((link, index) => (
                                <li key={index}>
                                    <Link href={link.url} className="text-slate-400 hover:text-primary transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-8 uppercase tracking-widest text-xs text-slate-500">Subscribe</h4>
                        <p className="text-slate-500 text-sm mb-6">Get the latest updates on data extraction techniques.</p>
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="Email address" 
                                className="bg-slate-900 border-none rounded-xl px-4 py-3 text-sm flex-1 focus:ring-2 focus:ring-primary outline-none text-white placeholder:text-slate-500" 
                            />
                            <Button className="rounded-xl px-4">
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-900 text-center text-slate-500 text-sm">
                    {settings.footerText}
                </div>
            </footer>
        </div>
    );
}
