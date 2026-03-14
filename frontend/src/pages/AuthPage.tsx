import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
    Loader2,
    Mail,
    Lock,
    User,
    Eye,
    EyeOff,
    ArrowLeft,
    CheckCircle2,
} from 'lucide-react';

// Google SVG Logo
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

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { signUp, signIn, signInWithGoogle, resetPassword } = useAuth();
    const { toast } = useToast();

    // Form states
    const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Login form
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register form
    const [registerName, setRegisterName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Forgot password form
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);

    // Password validation
    const validatePassword = (password: string) => {
        const errors: string[] = [];
        if (password.length < 8) errors.push('At least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('One number');
        return errors.length === 0;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await signIn(loginEmail, loginPassword);

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
            setLocation('/onboarding');
        }

        setIsLoading(false);
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

        const { error, requiresEmailConfirmation } = await signUp(registerEmail, registerPassword, registerName);

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
                setLocation('/onboarding');
            }
        }

        setIsLoading(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await resetPassword(forgotEmail);

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
        // OAuth will redirect, so we don't need to set isLoading(false) on success
    };


    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="p-4">
                <Button
                    variant="ghost"
                    onClick={() => setLocation('/')}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    <Card className="shadow-xl">
                        <CardHeader className="text-center space-y-2">
                            <img src="/favicon.png" alt="Xcraper" className="mx-auto w-12 h-12 rounded-xl mb-4" />
                            <CardTitle className="text-2xl font-bold">
                                {activeTab === 'forgot' ? 'Reset Password' : 'Welcome to Xcraper'}
                            </CardTitle>
                            <CardDescription>
                                {activeTab === 'login' && 'Sign in to your account to continue'}
                                {activeTab === 'register' && 'Create an account to get started'}
                                {activeTab === 'forgot' && 'Enter your email to receive a reset link'}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            {activeTab === 'forgot' ? (
                                // Forgot Password Form
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
                                        <Button type="submit" className="w-full" disabled={isLoading}>
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
                                // Login/Register Tabs
                                <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'login' | 'register')}>
                                    <TabsList className="grid w-full grid-cols-2 mb-6">
                                        <TabsTrigger value="login">Login</TabsTrigger>
                                        <TabsTrigger value="register">Register</TabsTrigger>
                                    </TabsList>

                                    {/* Login Form */}
                                    <TabsContent value="login">
                                        {/* Google Sign In - Primary */}
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

                                        <form onSubmit={handleLogin} className="space-y-4">
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
                                                        required
                                                    />
                                                </div>
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
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <Button type="submit" className="w-full" disabled={isLoading}>
                                                {isLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : null}
                                                Sign In
                                            </Button>
                                        </form>
                                    </TabsContent>

                                    {/* Register Form */}
                                    <TabsContent value="register">
                                        {/* Google Sign In - Primary */}
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

                                        <form onSubmit={handleRegister} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="register-name">Full Name</Label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="register-name"
                                                        type="text"
                                                        placeholder="Enter your name"
                                                        value={registerName}
                                                        onChange={(e) => setRegisterName(e.target.value)}
                                                        className="pl-10"
                                                        required
                                                    />
                                                </div>
                                            </div>

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
                                                        required
                                                    />
                                                </div>
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
                                                        onChange={(e) => {
                                                            setRegisterPassword(e.target.value);
                                                            validatePassword(e.target.value);
                                                        }}
                                                        className="pl-10 pr-10"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 h-4" />}
                                                    </button>
                                                </div>
                                                {/* Password requirements */}
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
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 h-4" />}
                                                    </button>
                                                </div>
                                                {confirmPassword && registerPassword !== confirmPassword && (
                                                    <p className="text-xs text-destructive">Passwords do not match</p>
                                                )}
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={isLoading || (registerPassword !== confirmPassword && confirmPassword !== '')}
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : null}
                                                Create Account
                                            </Button>
                                        </form>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </CardContent>

                        <CardFooter className="flex justify-center text-sm text-muted-foreground">
                            {activeTab !== 'forgot' && (
                                <p>
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
                        </CardFooter>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
}
