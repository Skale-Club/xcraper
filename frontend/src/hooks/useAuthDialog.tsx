import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AuthDialog from '@/components/AuthDialog';

type AuthTab = 'login' | 'register';

interface AuthDialogContextType {
    openAuth: (tab?: AuthTab) => void;
    closeAuth: () => void;
    isOpen: boolean;
    currentTab: AuthTab;
}

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<AuthTab>('login');

    const openAuth = useCallback((tab: AuthTab = 'login') => {
        setCurrentTab(tab);
        setIsOpen(true);
    }, []);

    const closeAuth = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <AuthDialogContext.Provider value={{ openAuth, closeAuth, isOpen, currentTab }}>
            {children}
            <AuthDialog open={isOpen} onOpenChange={setIsOpen} defaultTab={currentTab} />
        </AuthDialogContext.Provider>
    );
}

export function useAuthDialog() {
    const context = useContext(AuthDialogContext);
    if (context === undefined) {
        throw new Error('useAuthDialog must be used within an AuthDialogProvider');
    }
    return context;
}
