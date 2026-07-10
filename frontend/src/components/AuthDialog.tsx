import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
    Loader2,
    Mail,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';

const GoogleLogo = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
);

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: 'login' | 'register';
}

// Cloudflare Turnstile is enforced by Supabase when the captcha integration is
// on; without a token those auth calls fail, so the widget must be rendered
// whenever a site key is configured.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export default function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
    const [, setLocation] = useLocation();
    const { signUp, signIn, signInWithGoogle, resetPassword } = useAuth();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(defaultTab);
    const [loginStep, setLoginStep] = useState<'email' | 'password'>('email');
    const [registerStep, setRegisterStep] = useState<'email' | 'password'>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [forgotEmail, setForgotEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);

    // Only one auth form is visible at a time, so a single widget/token is shared.
    const turnstileRef = useRef<TurnstileInstance | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
    const captchaRequired = Boolean(TURNSTILE_SITE_KEY);
    const captchaPending = captchaRequired && !captchaToken;

    // Turnstile tokens are single-use: after every auth attempt the widget must
    // be reset so the next submit gets a fresh token.
    const resetCaptcha = () => {
        if (!captchaRequired) return;
        setCaptchaToken(undefined);
        turnstileRef.current?.reset();
    };

    const captchaWidget = captchaRequired ? (
        <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY!}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(undefined)}
            onError={() => setCaptchaToken(undefined)}
            options={{ size: 'flexible' }}
        />
    ) : null;

    const validatePassword = (password: string) => {
        const errors: string[] = [];
        if (password.length < 8) errors.push('At least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('One number');
        return errors.length === 0;
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setActiveTab(defaultTab);
            setLoginStep('email');
            setRegisterStep('email');
            setResetSent(false);
        }
        onOpenChange(next);
    };

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleLoginEmailStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidEmail(loginEmail)) {
            toast({
                variant: 'destructive',
                title: 'Invalid email',
                description: 'Please enter a valid email address.',
            });
            return;
        }
        setLoginStep('password');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await signIn(loginEmail, loginPassword, captchaToken);
        resetCaptcha();

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Login failed',
                description: error,
            });
        } else {
            toast({
                title: 'Welcome back!',
                description: 'You have been logged in successfully.',
            });
            onOpenChange(false);
            setLocation('/onboarding');
        }

        setIsLoading(false);
    };

    const handleRegisterEmailStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidEmail(registerEmail)) {
            toast({
                variant: 'destructive',
                title: 'Invalid email',
                description: 'Please enter a valid email address.',
            });
            return;
        }
        setRegisterStep('password');
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validatePassword(registerPassword)) {
            toast({
                variant: 'destructive',
                title: 'Invalid password',
                description: 'Please ensure your password meets all requirements.',
            });
            return;
        }

        if (registerPassword !== confirmPassword) {
            toast({
                variant: 'destructive',
                title: 'Passwords do not match',
                description: 'Please make sure both passwords are the same.',
            });
            return;
        }

        setIsLoading(true);

        const { error, requiresEmailConfirmation } = await signUp(registerEmail, registerPassword, undefined, captchaToken);
        resetCaptcha();

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Registration failed',
                description: error,
            });
        } else {
            if (requiresEmailConfirmation) {
                toast({
                    title: 'Account created!',
                    description: 'Please check your email to verify your account.',
                });
                setActiveTab('login');
            } else {
                toast({
                    title: 'Account created!',
                    description: 'Let’s finish setting up your account.',
                });
                onOpenChange(false);
                setLocation('/onboarding');
            }
        }

        setIsLoading(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await resetPassword(forgotEmail, captchaToken);
        resetCaptcha();

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error,
            });
        } else {
            setResetSent(true);
        }

        setIsLoading(false);
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        const { error } = await signInWithGoogle();
        if (error) {
            toast({
                variant: 'destructive',
                title: 'Google sign-in failed',
                description: error,
            });
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader className="space-y-2 text-center sm:text-center">
                    <img src="/favicon.png" alt="Xcraper" className="mx-auto w-12 h-12 rounded-xl" />
                    <DialogTitle className="text-2xl font-bold">
                        {activeTab === 'forgot' ? 'Reset Password' : 'Welcome to Xcraper'}
                    </DialogTitle>
                    <DialogDescription>
                        {activeTab === 'login' && 'Sign in to your account to continue'}
                        {activeTab === 'register' && 'Create an account to get started'}
                        {activeTab === 'forgot' && 'Enter your email to receive a reset link'}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2">
                    {activeTab === 'forgot' ? (
                        resetSent ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Check your email</h3>
                                <p className="text-muted-foreground mb-4">
                                    We've sent a password reset link to <strong>{forgotEmail}</strong>
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setActiveTab('login');
                                        setResetSent(false);
                                    }}
                                >
                                    Back to Login
                                </Button>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="forgot-email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="forgot-email"
                                            type="email"
                                            placeholder="Enter your email"
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>
                                {captchaWidget}
                                <Button type="submit" className="w-full" disabled={isLoading || captchaPending}>
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    Send Reset Link
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => setActiveTab('login')}
                                >
                                    Back to Login
                                </Button>
                            </form>
                        )
                    ) : (
                        <Tabs value={activeTab} onValueChange={(v: string) => {
                            setActiveTab(v as 'login' | 'register');
                            setLoginStep('email');
                            setRegisterStep('email');
                        }}>
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="login">Login</TabsTrigger>
                                <TabsTrigger value="register">Register</TabsTrigger>
                            </TabsList>

                            <TabsContent value="login">
                                {loginStep === 'email' ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            onClick={handleGoogleSignIn}
                                            disabled={isLoading}
                                            className="w-full mb-4"
                                        >
                                            <GoogleLogo />
                                            Continue with Google
                                        </Button>

                                        <div className="relative mb-4">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                                            </div>
                                        </div>

                                        <form onSubmit={handleLoginEmailStep} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="login-email">Email</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="login-email"
                                                        type="email"
                                                        placeholder="Enter your email"
                                                        value={loginEmail}
                                                        onChange={(e) => setLoginEmail(e.target.value)}
                                                        className="pl-10"
                                                        autoFocus
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <Button type="submit" className="w-full" disabled={!loginEmail}>
                                                Continue
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </form>
                                    </>
                                ) : (
                                    <form onSubmit={handleLogin} className="space-y-4">
                                        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 truncate text-sm">{loginEmail}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLoginStep('email');
                                                    setLoginPassword('');
                                                }}
                                                className="text-xs font-medium text-primary hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="login-password">Password</Label>
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    className="p-0 h-auto text-sm"
                                                    onClick={() => setActiveTab('forgot')}
                                                >
                                                    Forgot password?
                                                </Button>
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="login-password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="Enter your password"
                                                    value={loginPassword}
                                                    onChange={(e) => setLoginPassword(e.target.value)}
                                                    className="pl-10 pr-10"
                                                    autoFocus
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {captchaWidget}
                                        <Button type="submit" className="w-full" disabled={isLoading || captchaPending}>
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : null}
                                            Sign In
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full"
                                            onClick={() => setLoginStep('email')}
                                        >
                                            Back
                                        </Button>
                                    </form>
                                )}
                            </TabsContent>

                            <TabsContent value="register">
                                {registerStep === 'email' ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            onClick={handleGoogleSignIn}
                                            disabled={isLoading}
                                            className="w-full mb-4"
                                        >
                                            <GoogleLogo />
                                            Continue with Google
                                        </Button>

                                        <div className="relative mb-4">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">Or sign up with email</span>
                                            </div>
                                        </div>

                                        <form onSubmit={handleRegisterEmailStep} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="register-email">Email</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="register-email"
                                                        type="email"
                                                        placeholder="Enter your email"
                                                        value={registerEmail}
                                                        onChange={(e) => setRegisterEmail(e.target.value)}
                                                        className="pl-10"
                                                        autoFocus
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <Button type="submit" className="w-full" disabled={!registerEmail}>
                                                Continue
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </form>
                                    </>
                                ) : (
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 truncate text-sm">{registerEmail}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRegisterStep('email');
                                                    setRegisterPassword('');
                                                    setConfirmPassword('');
                                                }}
                                                className="text-xs font-medium text-primary hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="register-password">Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="register-password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="Create a password"
                                                    value={registerPassword}
                                                    onChange={(e) => setRegisterPassword(e.target.value)}
                                                    className="pl-10 pr-10"
                                                    autoFocus
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {registerPassword && (
                                                <div className="mt-2 space-y-1">
                                                    {[
                                                        { test: registerPassword.length >= 8, text: 'At least 8 characters' },
                                                        { test: /[A-Z]/.test(registerPassword), text: 'One uppercase letter' },
                                                        { test: /[a-z]/.test(registerPassword), text: 'One lowercase letter' },
                                                        { test: /[0-9]/.test(registerPassword), text: 'One number' },
                                                    ].map((req, i) => (
                                                        <div
                                                            key={i}
                                                            className={`flex items-center gap-2 text-xs ${req.test ? 'text-green-500' : 'text-muted-foreground'
                                                                }`}
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {req.text}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-password">Confirm Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="confirm-password"
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    placeholder="Confirm your password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="pl-10 pr-10"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {confirmPassword && registerPassword !== confirmPassword && (
                                                <p className="text-xs text-destructive">Passwords do not match</p>
                                            )}
                                        </div>

                                        {captchaWidget}
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={isLoading || captchaPending || (registerPassword !== confirmPassword && confirmPassword !== '')}
                                        >
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : null}
                                            Create Account
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full"
                                            onClick={() => setRegisterStep('email')}
                                        >
                                            Back
                                        </Button>
                                    </form>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </div>

                {activeTab !== 'forgot' && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        By continuing, you agree to our{' '}
                        <a href="/terms" className="text-primary hover:underline">
                            Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                        </a>
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}
