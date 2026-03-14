import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { signIn, signUp } = useAuth();
    const { toast } = useToast();

    const loginForm = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const registerForm = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    });

    const onLoginSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            const result = await signIn(data.email, data.password);
            if (result.error) {
                throw new ApiError(result.error, 400);
            }
            toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Login failed';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsLoading(false);
        }
    };

    const onRegisterSubmit = async (data: RegisterFormData) => {
        setIsLoading(true);
        try {
            const result = await signUp(data.email, data.password, data.name);
            if (result.error) {
                throw new ApiError(result.error, 400);
            }
            toast({
                title: 'Welcome!',
                description: result.requiresEmailConfirmation
                    ? 'Check your email to verify your account.'
                    : 'Your account has been created successfully.',
            });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Registration failed';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <motion.h1
                        className="text-4xl font-bold text-gray-900"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        🗺️ Maps Scraper
                    </motion.h1>
                    <motion.p
                        className="text-gray-600 mt-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        Extract business contacts from Google Maps
                    </motion.p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{isLogin ? 'Login' : 'Create Account'}</CardTitle>
                        <CardDescription>
                            {isLogin
                                ? 'Enter your credentials to access your account'
                                : 'Get started with 10 free credits'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLogin ? (
                            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        {...loginForm.register('email')}
                                    />
                                    {loginForm.formState.errors.email && (
                                        <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        {...loginForm.register('password')}
                                    />
                                    {loginForm.formState.errors.password && (
                                        <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                                    )}
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="John Doe"
                                        {...registerForm.register('name')}
                                    />
                                    {registerForm.formState.errors.name && (
                                        <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="register-email">Email</Label>
                                    <Input
                                        id="register-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        {...registerForm.register('email')}
                                    />
                                    {registerForm.formState.errors.email && (
                                        <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="register-password">Password</Label>
                                    <Input
                                        id="register-password"
                                        type="password"
                                        {...registerForm.register('password')}
                                    />
                                    {registerForm.formState.errors.password && (
                                        <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        {...registerForm.register('confirmPassword')}
                                    />
                                    {registerForm.formState.errors.confirmPassword && (
                                        <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                                    )}
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Creating account...' : 'Create Account'}
                                </Button>
                            </form>
                        )}

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    loginForm.reset();
                                    registerForm.reset();
                                }}
                                className="text-sm text-primary hover:underline"
                            >
                                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
