import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import AuthCallbackPage from './AuthCallbackPage';

const setLocationMock = vi.fn();

vi.mock('wouter', () => ({
    useLocation: () => ['/auth/callback', setLocationMock],
}));

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();

// Override the global setup.ts mock with one whose return values we can
// control per-test (see useSearchStream.test.ts for the same pattern).
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: (...args: unknown[]) => getSessionMock(...args),
            onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
        },
    },
}));

describe('AuthCallbackPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onAuthStateChangeMock.mockReturnValue({
            data: { subscription: { unsubscribe: unsubscribeMock } },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('navigates to /dashboard when getSession resolves a session', async () => {
        getSessionMock.mockResolvedValue({
            data: { session: { access_token: 'tok', user: { id: 'user-1' } } },
        });

        render(<AuthCallbackPage />);

        await waitFor(() => {
            expect(setLocationMock).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('shows an error and redirects to /login when no session arrives within 10s', async () => {
        vi.useFakeTimers();
        getSessionMock.mockResolvedValue({ data: { session: null } });

        render(<AuthCallbackPage />);

        // Let the getSession() promise's microtask (which finds no session and
        // is a no-op) resolve before advancing the fallback timeout.
        await act(async () => {
            await Promise.resolve();
        });

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
        expect(setLocationMock).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(setLocationMock).toHaveBeenCalledWith('/login');
    });
});
