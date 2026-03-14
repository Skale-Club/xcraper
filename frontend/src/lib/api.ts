import { supabase } from './supabase';

// API Types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    credits: number;
    isActive: boolean;
    onboardingCompleted: boolean;
    onboardingStep: number;
    company?: string | null;
    phone?: string | null;
    avatarUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SearchHistory {
    id: string;
    userId: string;
    query: string;
    location: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    apifyRunId?: string;
    creditsUsed: number;
    totalResults?: number;
    savedResults?: number;
    createdAt: string;
    completedAt?: string;
}

export interface SearchStatus {
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    itemsCount?: number;
    totalResults?: number;
    savedResults?: number;
    creditsUsed?: number;
    completedAt?: string;
    message?: string;
}

export interface Contact {
    id: string;
    searchId?: string;
    userId: string;
    placeId?: string;
    title: string;
    name: string;
    category?: string;
    address?: string;
    phone?: string;
    website?: string;
    email?: string;
    rating?: number;
    reviewCount?: number;
    latitude?: number;
    longitude?: number;
    openingHours?: Record<string, unknown>;
    imageUrl?: string;
    googleMapsUrl?: string;
    isFavorite: boolean;
    rawData?: Record<string, unknown>;
    createdAt: string;
}

export interface PaginatedContactsResponse {
    contacts: Contact[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface CreditTransaction {
    id: string;
    userId: string;
    amount: number;
    type: 'purchase' | 'search' | 'contact_save' | 'admin_adjustment' | 'bonus' | 'usage' | 'refund';
    description?: string;
    searchId?: string;
    createdAt: string;
}

export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    price: string;
    description?: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

// API Error class
export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

// Base fetch function with Supabase auth token
async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    // Get the current session token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(error.error || 'Request failed', response.status);
    }

    return response.json();
}

// Auth API
export const authApi = {
    getMe: () =>
        apiFetch<{ user: User }>('/auth/me'),

    sync: (email: string, name?: string, avatarUrl?: string) =>
        apiFetch<{ user: User; isNew: boolean }>('/auth/sync', {
            method: 'POST',
            body: JSON.stringify({ email, name, avatarUrl }),
        }),

    verify: () =>
        apiFetch<{ valid: boolean; userId?: string }>('/auth/verify'),

    adminGetUsers: () =>
        apiFetch<{ users: User[] }>('/auth/admin/users'),
};

// Users API
export const usersApi = {
    updateProfile: (data: { name?: string; email?: string }) =>
        apiFetch<{ message: string; user: User }>('/users/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    getAll: () =>
        apiFetch<{ users: User[] }>('/users/'),

    updateCredits: (userId: string, credits: number) =>
        apiFetch<{ message: string; user: User }>(`/users/${userId}/credits`, {
            method: 'PATCH',
            body: JSON.stringify({ credits }),
        }),

    toggleStatus: (userId: string, isActive: boolean) =>
        apiFetch<{ message: string; user: User }>(`/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive }),
        }),
};

// Search API
export const searchApi = {
    start: (query: string, location: string, maxResults?: number) =>
        apiFetch<{ message: string; searchId: string; apifyRunId: string }>('/search/', {
            method: 'POST',
            body: JSON.stringify({ query, location, maxResults }),
        }),

    getStatus: (searchId: string) =>
        apiFetch<SearchStatus>(`/search/${searchId}/status`),

    getResults: (searchId: string, page = 1, limit = 50) =>
        apiFetch<{ results: Contact[]; total: number; page: number; totalPages: number }>(
            `/search/${searchId}/results?page=${page}&limit=${limit}`
        ),

    getHistory: (page = 1, limit = 20) =>
        apiFetch<{ history: SearchHistory[]; total: number; page: number; totalPages: number }>(
            `/search/history?page=${page}&limit=${limit}`
        ),
};

// Contacts API
export const contactsApi = {
    getAll: (page = 1, limit = 50, search?: string, favoritesOnly?: boolean) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.append('search', search);
        if (favoritesOnly) params.append('favorite', 'true');
        return apiFetch<PaginatedContactsResponse>(
            `/contacts/?${params}`
        );
    },

    save: (contact: Partial<Contact>) =>
        apiFetch<{ message: string; contact: Contact }>('/contacts/', {
            method: 'POST',
            body: JSON.stringify(contact),
        }),

    delete: (contactId: string) =>
        apiFetch<{ message: string }>(`/contacts/${contactId}`, {
            method: 'DELETE',
        }),

    bulkDelete: (contactIds: string[]) =>
        apiFetch<{ message: string; deletedCount: number }>('/contacts/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ contactIds }),
        }),

    toggleFavorite: (contactId: string) =>
        apiFetch<{ message: string; contact: Contact }>(`/contacts/${contactId}/favorite`, {
            method: 'PATCH',
        }),

    export: (format: 'csv' | 'json' = 'csv') =>
        apiFetch<{ data: string | Contact[] }>(`/contacts/export/${format}`),

    exportCsv: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch('/api/contacts/export/csv', {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
        });

        if (!response.ok) throw new Error('Export failed');
        return response.blob();
    },

    exportJson: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch('/api/contacts/export/json', {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
        });

        if (!response.ok) throw new Error('Export failed');
        return response.blob();
    },
};

// Credits API
export const creditsApi = {
    getBalance: () =>
        apiFetch<{ credits: number }>('/credits/balance'),

    getPackages: () =>
        apiFetch<{ packages: CreditPackage[] }>('/credits/packages'),

    purchase: (packageId: string) =>
        apiFetch<{ message: string; newBalance: number }>('/credits/purchase', {
            method: 'POST',
            body: JSON.stringify({ packageId }),
        }),

    getTransactions: (page = 1, limit = 20) =>
        apiFetch<{ transactions: CreditTransaction[]; total: number; page: number; totalPages: number }>(
            `/credits/history?page=${page}&limit=${limit}`
        ),

    getHistory: (page = 1, limit = 20) =>
        apiFetch<{ transactions: CreditTransaction[]; total: number; page: number; totalPages: number }>(
            `/credits/history?page=${page}&limit=${limit}`
        ),

    adminGetTransactions: (page = 1, limit = 50) =>
        apiFetch<{ transactions: CreditTransaction[] }>(`/credits/admin/transactions?page=${page}&limit=${limit}`),
};

// Payments API (Stripe)
export const paymentsApi = {
    getPackages: () =>
        apiFetch<{ packages: CreditPackage[] }>('/payments/packages'),

    createCheckout: (packageId: string) =>
        apiFetch<{ message: string; sessionId: string; url: string }>('/payments/checkout', {
            method: 'POST',
            body: JSON.stringify({ packageId }),
        }),

    verifyPayment: (sessionId: string) =>
        apiFetch<{ message: string; credits: number }>(`/payments/verify/${sessionId}`),
};

// Settings types
export interface PublicSettings {
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

export interface AdminSettings extends PublicSettings {
    id: string;
    faviconUrl?: string;
    twitterHandle?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactAddress?: string;
    googleAnalyticsId?: string;
    customHeadCode?: string;
    customBodyCode?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCreditPackage {
    id: string;
    name: string;
    credits: number;
    price: string;
    description?: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

// Settings API
export const settingsApi = {
    getPublic: () =>
        apiFetch<{ settings: PublicSettings; packages: CreditPackage[] }>('/settings/public'),

    getAdmin: () =>
        apiFetch<{ settings: AdminSettings; packages: AdminCreditPackage[] }>('/settings/'),

    update: (data: Partial<AdminSettings>) =>
        apiFetch<{ message: string; settings: AdminSettings }>('/settings/', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    createPackage: (data: {
        name: string;
        credits: number;
        price: string;
        description?: string;
        isPopular?: boolean;
        sortOrder?: number;
    }) =>
        apiFetch<{ message: string; package: AdminCreditPackage }>('/settings/packages', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updatePackage: (packageId: string, data: Partial<{
        name: string;
        credits: number;
        price: string;
        description: string;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }>) =>
        apiFetch<{ message: string; package: AdminCreditPackage }>(`/settings/packages/${packageId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    deletePackage: (packageId: string) =>
        apiFetch<{ message: string }>(`/settings/packages/${packageId}`, {
            method: 'DELETE',
        }),
};

// Onboarding types
export interface OnboardingStatus {
    onboardingCompleted: boolean;
    currentStep: number;
    data: {
        name?: string;
        company?: string;
        phone?: string;
    };
}

export interface OnboardingData {
    name?: string;
    company?: string;
    phone?: string;
    step?: number;
    completed?: boolean;
}

// Onboarding API
export const onboardingApi = {
    getStatus: () =>
        apiFetch<OnboardingStatus>('/onboarding/status'),

    saveProgress: (data: OnboardingData) =>
        apiFetch<{ message: string; step?: number }>('/onboarding/progress', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    complete: (data?: OnboardingData) =>
        apiFetch<{ message: string; completed: boolean }>('/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify(data || {}),
        }),

    skip: () =>
        apiFetch<{ message: string; completed: boolean }>('/onboarding/skip', {
            method: 'POST',
        }),
};
