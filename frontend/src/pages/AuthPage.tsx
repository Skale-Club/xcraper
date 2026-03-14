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
    Chrome,
    Github,
    ArrowLeft,
    CheckCircle2,
} from 'lucide-react';

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { signUp, signIn, signInWithGoogle, signInWithGithub, resetPassword } = useAuth();
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

    const handleGithubSignIn = async () => {
        setIsLoading(true);
        const { error } = await signInWithGithub();
        if (error) {
            toast({
                variant: 'destructive',
                title: 'GitHub sign-in failed',
                description: error,
            });
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
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
                    <Card className="shadow-xl border-0">
                        <CardHeader className="text-center space-y-2">
                            <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">🗺️</span>
                            </div>
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
                                        <p className="text-gray-600 mb-4">
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
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                        <form onSubmit={handleLogin} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="login-email">Email</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

                                        {/* Social Login */}
                                        <div className="mt-6">
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-4">
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={handleGoogleSignIn}
                                                    disabled={isLoading}
                                                >
                                                    <Chrome className="w-4 h-4 mr-2" />
                                                    Google
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={handleGithubSignIn}
                                                    disabled={isLoading}
                                                >
                                                    <Github className="w-4 h-4 mr-2" />
                                                    GitHub
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* Register Form */}
                                    <TabsContent value="register">
                                        <form onSubmit={handleRegister} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="register-name">Full Name</Label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                                                                className={`flex items-center gap-2 text-xs ${req.test ? 'text-green-600' : 'text-gray-400'
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
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                                {confirmPassword && registerPassword !== confirmPassword && (
                                                    <p className="text-xs text-red-500">Passwords do not match</p>
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

                                        {/* Social Register */}
                                        <div className="mt-6">
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-white px-2 text-gray-500">Or sign up with</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-4">
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={handleGoogleSignIn}
                                                    disabled={isLoading}
                                                >
                                                    <Chrome className="w-4 h-4 mr-2" />
                                                    Google
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={handleGithubSignIn}
                                                    disabled={isLoading}
                                                >
                                                    <Github className="w-4 h-4 mr-2" />
                                                    GitHub
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </CardContent>

                        <CardFooter className="flex justify-center text-sm text-gray-500">
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
