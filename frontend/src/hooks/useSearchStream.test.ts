import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSearchStreamFetch } from './useSearchStream';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSearchStream Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('useSearchStreamFetch', () => {
        it('should not fetch when disabled', () => {
            renderHook(() =>
                useSearchStreamFetch({
                    searchId: 'test-search-id',
                    enabled: false,
                })
            );

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should not fetch when searchId is null', () => {
            renderHook(() =>
                useSearchStreamFetch({
                    searchId: null,
                    enabled: true,
                })
            );

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should return initial state correctly', () => {
            const { result } = renderHook(() =>
                useSearchStreamFetch({
                    searchId: 'test-search-id',
                    enabled: false,
                })
            );

            expect(result.current.status).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.isConnected).toBe(false);
        });

        it('should call onUpdate when receiving data', async () => {
            const onUpdate = vi.fn();
            const mockData = {
                status: 'running',
                totalResults: 100,
                savedResults: 50,
            };

            // Mock successful SSE-like response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: {
                    getReader: () => ({
                        read: vi.fn()
                            .mockResolvedValueOnce({
                                done: false,
                                value: new TextEncoder().encode(
                                    `data: ${JSON.stringify(mockData)}\n\n`
                                ),
                            })
                            .mockResolvedValueOnce({ done: true }),
                        releaseLock: vi.fn(),
                    }),
                },
            });

            renderHook(() =>
                useSearchStreamFetch({
                    searchId: 'test-search-id',
                    enabled: true,
                    onUpdate,
                })
            );

            await waitFor(() => {
                expect(onUpdate).toHaveBeenCalled();
            });
        });

        it('should call onComplete when search is completed', async () => {
            const onComplete = vi.fn();
            const mockData = {
                status: 'completed',
                totalResults: 100,
                savedResults: 100,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: {
                    getReader: () => ({
                        read: vi.fn()
                            .mockResolvedValueOnce({
                                done: false,
                                value: new TextEncoder().encode(
                                    `data: ${JSON.stringify(mockData)}\n\n`
                                ),
                            })
                            .mockResolvedValueOnce({ done: true }),
                        releaseLock: vi.fn(),
                    }),
                },
            });

            renderHook(() =>
                useSearchStreamFetch({
                    searchId: 'test-search-id',
                    enabled: true,
                    onComplete,
                })
            );

            await waitFor(() => {
                expect(onComplete).toHaveBeenCalled();
            });
        });

        it('should call onError when fetch fails', async () => {
            const onError = vi.fn();
            const mockError = new Error('Network error');

            mockFetch.mockRejectedValueOnce(mockError);

            renderHook(() =>
                useSearchStreamFetch({
                    searchId: 'test-search-id',
                    enabled: true,
                    onError,
                })
            );

            await waitFor(() => {
                expect(onError).toHaveBeenCalled();
            });
        });
    });
});
