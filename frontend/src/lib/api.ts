import { supabase } from './supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getApiUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/api')
        ? path
        : `/api${path}`;

    return API_BASE_URL
        ? `${API_BASE_URL}${normalizedPath}`
        : normalizedPath;
}

 // API Types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    credits: number;
    monthlyCredits?: number;
    rolloverCredits?: number;
    purchasedCredits?: number;
    totalCredits?: number;
    isActive: boolean;
    onboardingCompleted: boolean;
    onboardingStep: number;
    company?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    subscriptionPlanId?: string | null;
    subscriptionStatus?: 'incomplete' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
    trialEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    autoTopUpEnabled?: boolean;
    monthlyTopUpCap?: string | null;
    currentMonthTopUpSpend?: string | null;
    topUpThreshold?: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    description?: string | null;
    price: string;
    billingInterval: 'monthly' | 'yearly';
    monthlyCredits: number;
    isPopular: boolean;
    isActive: boolean;
    allowAutoTopUp: boolean;
    allowManualPurchase: boolean;
    allowOverage?: boolean;
    defaultTopUpCredits?: number | null;
    defaultTopUpPrice?: string | null;
    defaultMonthlyTopUpCap?: string | null;
    topUpThreshold?: number | null;
    allowRollover: boolean;
    maxRolloverCredits?: number | null;
    rolloverExpirationDays?: number | null;
    trialDays?: number | null;
    trialCredits?: number | null;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminSubscriptionPlan extends SubscriptionPlan {
    subscriberCount: number;
    isPublic: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
}

export interface SearchHistory {
    id: string;
    userId: string;
    query: string;
    location: string;
    requestedMaxResults: number;
    requestEnrichment: boolean;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    apifyRunId?: string | null;
    apifyActorId?: string | null;
    apifyActorName?: string | null;
    apifyDatasetId?: string | null;
    apifyStatusMessage?: string | null;
    apifyUsageUsd?: string | null;
    apifyContainerUrl?: string | null;
    apifyStartedAt?: string | null;
    apifyFinishedAt?: string | null;
    creditsUsed: number;
    totalResults?: number;
    savedResults?: number;
    createdAt: string;
    completedAt?: string | null;
}

export interface SearchStatus {
    requestedMaxResults?: number;
    requestEnrichment?: boolean;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    progress?: number;
    itemsCount?: number;
    totalResults?: number;
    savedResults?: number;
    standardResults?: number;
    enrichedResults?: number;
    creditsUsed?: number;
    completedAt?: string | null;
    apifyRunId?: string | null;
    apifyActorId?: string | null;
    apifyActorName?: string | null;
    apifyDatasetId?: string | null;
    apifyStatusMessage?: string | null;
    apifyUsageUsd?: string | null;
    apifyContainerUrl?: string | null;
    apifyStartedAt?: string | null;
    apifyFinishedAt?: string | null;
    message?: string;
}

export interface PlacesSuggestion {
    kind: 'place' | 'query';
    placeId?: string;
    text: string;
    mainText?: string;
    secondaryText?: string;
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
    // Social media
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    pinterest?: string;
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

export type SearchResultsSortBy = 'business' | 'contact' | 'location';
export type SortDirection = 'asc' | 'desc';

export interface CreditTransaction {
    id: string;
    userId: string;
    amount: number;
    type: 'monthly_grant' | 'purchase' | 'usage' | 'refund' | 'bonus' | 'top_up' | 'rollover' | 'expired' | 'adjustment';
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

export interface SubscriptionDetails {
    id: string;
    planId: string;
    planName: string;
    status: 'incomplete' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    creditsRemaining: number;
    creditsUsedThisPeriod: number;
    monthlyCredits: number;
}

export interface OnboardingStatus {
    completed: boolean;
    step: number;
    totalSteps: number;
    currentStep?: number;
    onboardingCompleted?: boolean;
    data?: {
        name?: string;
        company?: string;
        phone?: string;
    };
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

    const response = await fetch(getApiUrl(endpoint), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(error.message || error.error || 'Request failed', response.status);
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

    changePassword: (currentPassword: string, newPassword: string) =>
        apiFetch<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        }),
};

 // Users API
export const usersApi = {
    updateProfile: (data: { name?: string; company?: string; phone?: string }) =>
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
    start: (query: string, location: string, maxResults?: number, requestEnrichment = false) =>
        apiFetch<{ message: string; searchId: string; apifyRunId: string; estimatedCredits?: number; creditsPerLead?: number; requestEnrichment?: boolean }>('/search/', {
            method: 'POST',
            body: JSON.stringify({ query, location, maxResults, requestEnrichment }),
        }),

    get: (searchId: string) =>
        apiFetch<{ search: SearchHistory; contacts: Contact[] }>(`/search/${searchId}`),

    getStatus: (searchId: string) =>
        apiFetch<SearchStatus>(`/search/${searchId}/status`),

    pause: (searchId: string) =>
        apiFetch<{ message: string; status: 'paused'; completedAt?: string }>(`/search/${searchId}/pause`, {
            method: 'POST',
        }),

    getResults: (
        searchId: string,
        page = 1,
        limit = 50,
        favoritesOnly = false,
        sortBy?: SearchResultsSortBy,
        sortDirection: SortDirection = 'asc'
    ) => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });
        if (favoritesOnly) params.append('favorite', 'true');
        if (sortBy) {
            params.append('sortBy', sortBy);
            params.append('sortDirection', sortDirection);
        }

        return apiFetch<{ results: Contact[]; total: number; page: number; totalPages: number }>(
            `/search/${searchId}/results?${params.toString()}`
        );
    },

    getHistory: (page = 1, limit = 20) =>
        apiFetch<{ history: SearchHistory[]; total: number; page: number; totalPages: number }>(
            `/search/history?page=${page}&limit=${limit}`
        ),
};

export const placesApi = {
    autocomplete: (mode: 'query' | 'location', input: string) => {
        const params = new URLSearchParams({
            mode,
            input,
        });

        return apiFetch<{ suggestions: PlacesSuggestion[] }>(`/places/autocomplete?${params.toString()}`);
    },
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

        const response = await fetch(getApiUrl('/contacts/export/csv'), {
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

        const response = await fetch(getApiUrl('/contacts/export/json'), {
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

    getPortalUrl: () =>
        apiFetch<{ url: string }>('/payments/portal'),
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
    creditsPerStandardResult: number;
    creditsPerEnrichedResult: number;
}

export interface AdminSettings extends PublicSettings {
    id: string;
    faviconUrl?: string;
    twitterHandle?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactAddress?: string;
    gtmContainerId?: string;
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
            body: JSON.stringify(data)
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
            body: JSON.stringify(data)
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
            body: JSON.stringify(data)
        }),

    deletePackage: (packageId: string) =>
        apiFetch<{ message: string }>(`/settings/packages/${packageId}`, {
            method: 'DELETE'
        })
};

// Subscription API
export const subscriptionApi = {
    getPublicPlans: () =>
        apiFetch<{ plans: SubscriptionPlan[] }>(`/subscriptions/public`),

    getSubscription: () =>
        apiFetch<SubscriptionDetails>('/subscriptions/me'),

    subscribe: (planId: string) =>
        apiFetch<{ url: string; sessionId: string }>(`/subscriptions/subscribe`, {
            method: 'POST',
            body: JSON.stringify({ planId })
        }),

    cancel: () =>
        apiFetch<{ message: string; subscription: SubscriptionDetails | null }>(`/subscriptions/cancel`, {
            method: 'POST'
        }),

    reactivate: () =>
        apiFetch<{ message: string; subscription: SubscriptionDetails | null }>(`/subscriptions/reactivate`, {
            method: 'POST'
        }),

    verifyCheckout: (sessionId: string) =>
        apiFetch<{ message: string; subscription: SubscriptionDetails | null; creditsGranted: number }>(`/subscriptions/verify/${sessionId}`),

    updateAutoTopUp: (data: { enabled?: boolean; threshold?: number; monthlyCap?: string }) =>
        apiFetch<{ user: User }>('/subscriptions/auto-topup', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    getPortalUrl: () =>
        apiFetch<{ url: string }>('/subscriptions/portal'),

    // Admin
    getAdminPlans: () =>
        apiFetch<{ plans: AdminSubscriptionPlan[] }>('/subscriptions/admin/plans'),

    updatePlan: (id: string, data: Partial<SubscriptionPlan>) =>
        apiFetch<{ plan: AdminSubscriptionPlan }>(`/subscriptions/admin/plans/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    deletePlan: (id: string) =>
        apiFetch<{ message: string; plan: AdminSubscriptionPlan }>(`/subscriptions/admin/plans/${id}`, {
            method: 'DELETE',
        }),
};

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

// Admin API Types
export interface AdminStats {
    totalUsers: number;
    totalContacts: number;
    totalSearches: number;
    totalCreditsDistributed: number;
    recentSignups: number;
    recentSearches: number;
    totalPurchasedCredits: number;
    totalUsedCredits: number;
}

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    credits: number;
    isActive: boolean;
    onboardingCompleted: boolean;
    company?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminUserDetails extends AdminUser {
    phone?: string | null;
    avatarUrl?: string | null;
}

export interface AdminContact {
    id: string;
    title: string;
    category?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    rating?: string;
    reviewCount?: number;
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export interface AdminSearch {
    id: string;
    query: string;
    location: string;
    requestedMaxResults: number;
    requestEnrichment: boolean;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    apifyRunId?: string | null;
    apifyActorId?: string | null;
    apifyActorName?: string | null;
    apifyDatasetId?: string | null;
    apifyStatusMessage?: string | null;
    apifyUsageUsd?: string | null;
    creditsUsed: number;
    totalResults?: number;
    standardResultsCount?: number;
    enrichedResultsCount?: number;
    createdAt: string;
    completedAt?: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export interface AdminSearchTimeline {
    timeline: Array<{
        id: string;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
        createdAt: string;
    }>;
    stats: {
        total: number;
        completed: number;
        failed: number;
        running: number;
        pending: number;
        paused: number;
    };
}

export interface AdminTransaction {
    id: string;
    amount: number;
    type: string;
    description?: string;
    subscriptionPlanName?: string | null;
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Admin API
export const adminApi = {
    // Dashboard statistics
    getStats: () =>
        apiFetch<AdminStats>('/admin/stats'),

    // Users management
    getUsers: (page = 1, limit = 20) =>
        apiFetch<{ users: AdminUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
            `/admin/users?page=${page}&limit=${limit}`
        ),

    getUser: (userId: string) =>
        apiFetch<{ user: AdminUserDetails; stats: { totalSearches: number; totalContacts: number; totalTransactions: number } }>(
            `/admin/users/${userId}`
        ),

    updateUser: (userId: string, data: Partial<{ name: string; credits: number; role: 'user' | 'admin'; isActive: boolean }>) =>
        apiFetch<{ user: AdminUser }>(`/admin/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    addCredits: (userId: string, amount: number, description?: string) =>
        apiFetch<{ user: AdminUser }>(`/admin/users/${userId}/credits`, {
            method: 'POST',
            body: JSON.stringify({ amount, description }),
        }),

    deleteUser: (userId: string) =>
        apiFetch<{ message: string; user: AdminUser }>(`/admin/users/${userId}`, {
            method: 'DELETE',
        }),

    // Contacts management
    getContacts: (page = 1, limit = 20) =>
        apiFetch<{ contacts: AdminContact[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
            `/admin/contacts?page=${page}&limit=${limit}`
        ),

    // Searches management
    getSearches: (page = 1, limit = 20, status?: string, search?: string) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status && status !== 'all') params.append('status', status);
        if (search) params.append('search', search);
        return apiFetch<{ searches: AdminSearch[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
            `/admin/searches?${params}`
        );
    },

    getSearchesTimeline: () =>
        apiFetch<AdminSearchTimeline>('/admin/searches/timeline'),

    // Transactions management
    getTransactions: (page = 1, limit = 20) =>
        apiFetch<{ transactions: AdminTransaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
            `/admin/transactions?page=${page}&limit=${limit}`
        ),
};

async function uploadFile(endpoint: string, file: File, fieldName: string): Promise<{ message: string; url: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(error.message || error.error || 'Upload failed', response.status);
    }

    return response.json();
}

async function deleteUploadedFile(endpoint: string): Promise<{ message: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(getApiUrl(endpoint), {
        method: 'DELETE',
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(error.message || error.error || 'Delete failed', response.status);
    }

    return response.json();
}

export const uploadApi = {
    uploadLogo: (file: File) =>
        uploadFile('/upload/logo', file, 'logo'),

    deleteLogo: () =>
        deleteUploadedFile('/upload/logo'),

    uploadFavicon: (file: File) =>
        uploadFile('/upload/favicon', file, 'favicon'),

    deleteFavicon: () =>
        deleteUploadedFile('/upload/favicon'),

    uploadOgImage: (file: File) =>
        uploadFile('/upload/og-image', file, 'ogImage'),

    uploadAvatar: (file: File) =>
        uploadFile('/upload/avatar', file, 'avatar'),

    deleteAvatar: () =>
        deleteUploadedFile('/upload/avatar'),
};
