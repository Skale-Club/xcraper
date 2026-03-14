import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
    value: string;
    onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used within Tabs');
    }
    return context;
}

export function Tabs({
    value,
    onValueChange,
    className,
    children,
}: React.HTMLAttributes<HTMLDivElement> & {
    value: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}
            {...props}
        />
    );
}

export function TabsTrigger({
    value,
    className,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
    const { value: selectedValue, onValueChange } = useTabsContext();
    const isActive = selectedValue === value;

    return (
        <button
            type="button"
            className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
                isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                className
            )}
            onClick={() => onValueChange(value)}
            {...props}
        >
            {children}
        </button>
    );
}

export function TabsContent({
    value,
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
    const { value: selectedValue } = useTabsContext();

    if (selectedValue !== value) {
        return null;
    }

    return (
        <div className={cn('mt-2', className)} {...props}>
            {children}
        </div>
    );
}
