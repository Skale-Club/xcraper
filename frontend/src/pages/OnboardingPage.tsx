import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { onboardingApi, ApiError } from '@/lib/api';
import {
    User,
    Building,
    Phone,
    Target,
    Zap,
    Coins,
    ArrowRight,
    ArrowLeft,
    Check,
    Loader2,
    Sparkles,
} from 'lucide-react';

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
    const { user, refreshUser } = useAuth();
    const { toast } = useToast();
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        name: user?.name ?? '',
        company: user?.company ?? '',
        phone: user?.phone ?? '',
    });

    const buildPayload = () => ({
        name: formData.name.trim() || undefined,
        company: formData.company.trim() || undefined,
        phone: formData.phone.trim() || undefined,
    });

    // Get onboarding status
    const { data: statusData, isLoading: statusLoading } = useQuery({
        queryKey: ['onboarding-status'],
        queryFn: () => onboardingApi.getStatus(),
    });

    // Redirect if already completed onboarding
    useEffect(() => {
        if (statusData?.onboardingCompleted) {
            navigate('/dashboard');
        }
        if (statusData?.data) {
            setCurrentStep(Math.min(statusData.currentStep ?? 0, TOTAL_STEPS - 1));
            setFormData(prev => ({
                ...prev,
                name: statusData.data.name || prev.name,
                company: statusData.data.company || '',
                phone: statusData.data.phone || '',
            }));
        }
    }, [statusData, navigate]);

    // Save progress mutation
    const saveProgressMutation = useMutation({
        mutationFn: (data: { step: number; data?: typeof formData }) =>
            onboardingApi.saveProgress({
                name: data.data?.name?.trim() || undefined,
                company: data.data?.company?.trim() || undefined,
                phone: data.data?.phone?.trim() || undefined,
                step: data.step,
            }),
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to save onboarding progress';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    // Complete onboarding mutation
    const completeMutation = useMutation({
        mutationFn: () => onboardingApi.complete(buildPayload()),
        onSuccess: async () => {
            await refreshUser();
            queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
            toast({
                title: 'Welcome to XCraper!',
                description: 'Your account is set up and ready to go.',
            });
            navigate('/dashboard');
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to complete onboarding';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    // Skip onboarding mutation
    const skipMutation = useMutation({
        mutationFn: () => onboardingApi.skip(),
        onSuccess: async () => {
            await refreshUser();
            navigate('/dashboard');
        },
    });

    const handleNext = async () => {
        if (currentStep < TOTAL_STEPS - 1) {
            const nextStep = currentStep + 1;
            await saveProgressMutation.mutateAsync({ step: nextStep, data: formData });
            setCurrentStep(nextStep);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        completeMutation.mutate();
    };

    const handleSkip = () => {
        skipMutation.mutate();
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (statusLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const steps = [
        // Step 0: Welcome
        <motion.div
            key="welcome"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center"
        >
            <div className="mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to XCraper!</h2>
                <p className="text-gray-600">
                    Let's get you set up in just a few quick steps.
                </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-left">
                <h3 className="font-medium text-blue-900 mb-2">Here's what you'll be able to do:</h3>
                <ul className="space-y-2 text-blue-800 text-sm">
                    <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-600" />
                        Search Google Maps for business contacts
                    </li>
                    <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-600" />
                        Save and organize your leads
                    </li>
                    <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-600" />
                        Export contacts to CSV or JSON
                    </li>
                    <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-600" />
                        Manage your credits and billing
                    </li>
                </ul>
            </div>
        </motion.div>,

        // Step 1: Profile Info
        <motion.div
            key="profile"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
        >
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile</h2>
                <p className="text-gray-600">
                    Help us personalize your experience
                </p>
            </div>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your full name"
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="company">Company (Optional)</Label>
                    <div className="relative mt-1">
                        <Input
                            id="company"
                            value={formData.company}
                            onChange={(e) => handleInputChange('company', e.target.value)}
                            placeholder="Your company name"
                        />
                        <Building className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <div className="relative mt-1">
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="Your phone number"
                            type="tel"
                        />
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>
        </motion.div>,

        // Step 2: How it Works
        <motion.div
            key="how-it-works"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
        >
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">How XCraper Works</h2>
                <p className="text-gray-600">
                    Extract business contacts in 3 simple steps
                </p>
            </div>
            <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold shrink-0">
                        1
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">Search Google Maps</h3>
                        <p className="text-sm text-gray-600">Enter a business type and location to find relevant contacts</p>
                    </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold shrink-0">
                        2
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">Review Results</h3>
                        <p className="text-sm text-gray-600">Browse through phone numbers, emails, addresses, and more</p>
                    </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold shrink-0">
                        3
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">Save & Export</h3>
                        <p className="text-sm text-gray-600">Save contacts to your list or export them for your CRM</p>
                    </div>
                </div>
            </div>
        </motion.div>,

        // Step 3: Credits Explanation
        <motion.div
            key="credits"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
        >
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coins className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Understanding Credits</h2>
                <p className="text-gray-600">
                    XCraper uses a simple credit-based system
                </p>
            </div>
            <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span className="font-medium text-gray-900">Credit Usage</span>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex justify-between">
                            <span>Each search</span>
                            <span className="font-medium">1 credit</span>
                        </li>
                        <li className="flex justify-between">
                            <span>Each contact saved</span>
                            <span className="font-medium">1 credit</span>
                        </li>
                    </ul>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-green-800 font-medium mb-1">Your Current Balance</p>
                    <p className="text-3xl font-bold text-green-600">{user?.credits ?? 0} credits</p>
                    <p className="text-sm text-green-600 mt-1">Purchase more anytime from the Credits page</p>
                </div>
            </div>
        </motion.div>,
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">XCraper</h1>
                    <p className="text-gray-600">Google Maps Contact Extractor</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                            <div
                                key={index}
                                className={`w-full h-2 rounded-full mx-1 transition-colors ${index <= currentStep ? 'bg-primary' : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                        Step {currentStep + 1} of {TOTAL_STEPS}
                    </p>
                </div>

                {/* Card */}
                <Card className="shadow-xl">
                    <CardContent className="p-6">
                        <AnimatePresence mode="wait">
                            {steps[currentStep]}
                        </AnimatePresence>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-6 pt-6 border-t">
                            <div>
                                {currentStep > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={completeMutation.isPending || saveProgressMutation.isPending}
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                )}
                                {currentStep === 0 && (
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkip}
                                        disabled={skipMutation.isPending || saveProgressMutation.isPending}
                                        className="text-gray-500"
                                    >
                                        Skip for now
                                    </Button>
                                )}
                            </div>
                            <div>
                                {currentStep < TOTAL_STEPS - 1 ? (
                                    <Button onClick={handleNext} disabled={saveProgressMutation.isPending}>
                                        {saveProgressMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                Continue
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleComplete}
                                        disabled={completeMutation.isPending}
                                    >
                                        {completeMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Setting up...
                                            </>
                                        ) : (
                                            <>
                                                Get Started
                                                <Check className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
