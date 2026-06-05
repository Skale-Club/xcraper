import { useEffect } from 'react';
import { useLocation } from 'wouter';
import LandingPage from '@/pages/LandingPage';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { openAuth, isOpen } = useAuthDialog();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;

        if (isAuthenticated) {
            setLocation('/dashboard');
            return;
        }

        if (!isOpen) {
            openAuth('login');
        }
    }, [isAuthenticated, isLoading, isOpen, openAuth, setLocation]);

    return <LandingPage />;
}
