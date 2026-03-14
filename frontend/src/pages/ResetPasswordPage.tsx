import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    ArrowLeft,
} from 'lucide-react';

export default function ResetPasswordPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Password validation
    const passwordRequirements = [
        { test: password.length >= 8, text: 'At least 8 characters' },
        { test: /[A-Z]/.test(password), text: 'One uppercase letter' },
        { test: /[a-z]/.test(password), text: 'One lowercase letter' },
        { test: /[0-9]/.test(password), text: 'One number' },
    ];

    const isPasswordValid = passwordRequirements.every(req => req.test);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isPasswordValid) {
            setError('Password does not meet all requirements');
            return;
        }

        if (!passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                setError(error.message);
            } else {
                setIsSuccess(true);
                toast({
                    title: 'Password updated!',
                    description: 'Your password has been changed successfully.',
                });

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    setLocation('/login');
                }, 3000);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
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

                <main className="flex-1 flex items-center justify-center p-4">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-md"
                    >
                        <Card className="shadow-xl border-0">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', duration: 0.5 }}
                                    >
                                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                    </motion.div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Password Updated!
                                    </h2>
                                    <p className="text-gray-600 mb-4">
                                        Your password has been changed successfully.
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        Redirecting to login...
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
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
                                <Lock className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
                            <CardDescription>
                                Enter your new password below
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                {/* New Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="password">New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter new password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
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
                                    {password && (
                                        <div className="mt-2 space-y-1">
                                            {passwordRequirements.map((req, i) => (
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

                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Confirm new password"
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
                                    {confirmPassword && !passwordsMatch && (
                                        <p className="text-xs text-red-500">Passwords do not match</p>
                                    )}
                                </div>

                                {/* Error message */}
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-sm text-red-600">{error}</p>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading || !isPasswordValid || !passwordsMatch}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    Update Password
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
}
