import { useEffect, useRef, useState, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface SSEStatusPayload {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    progress?: number;
    itemsCount?: number;
    totalResults?: number | null;
    savedResults?: number | null;
    creditsUsed?: number;
    message?: string;
    completedAt?: string | null;
    apifyStatusMessage?: string | null;
}

interface UseSearchStreamOptions {
    searchId: string | null;
    enabled?: boolean;
    onUpdate?: (data: SSEStatusPayload) => void;
    onComplete?: (data: SSEStatusPayload) => void;
    onError?: (error: Error) => void;
}

interface UseSearchStreamReturn {
    status: SSEStatusPayload | null;
    isConnected: boolean;
    error: Error | null;
    disconnect: () => void;
}

export function useSearchStream({
    searchId,
    enabled = true,
    onUpdate,
    onComplete,
    onError,
}: UseSearchStreamOptions): UseSearchStreamReturn {
    const [status, setStatus] = useState<SSEStatusPayload | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        if (!searchId || !enabled) {
            disconnect();
            return;
        }

        const connect = async () => {
            try {
                // Get the current session token
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    throw new Error('No authentication token available');
                }

                // Build SSE URL with token in query params (EventSource doesn't support headers)
                const baseUrl = getApiUrl(`/sse/${searchId}/stream`);
                const url = `${baseUrl}?token=${encodeURIComponent(token)}`;

                const eventSource = new EventSource(url);
                eventSourceRef.current = eventSource;

                eventSource.onopen = () => {
                    setIsConnected(true);
                    setError(null);
                };

                eventSource.onmessage = (event) => {
                    try {
                        const data: SSEStatusPayload = JSON.parse(event.data);
                        setStatus(data);
                        onUpdate?.(data);

                        // Call onComplete when search is finished
                        if (['completed', 'failed', 'paused'].includes(data.status)) {
                            onComplete?.(data);
                            // Don't disconnect immediately, let the server send close event
                        }
                    } catch (parseError) {
                        console.error('Error parsing SSE message:', parseError);
                    }
                };

                eventSource.addEventListener('close', (event: MessageEvent) => {
                    console.log('SSE stream closed:', event.data);
                    disconnect();
                });

                eventSource.onerror = (err) => {
                    console.error('SSE error:', err);
                    const connectionError = new Error('SSE connection error');
                    setError(connectionError);
                    onError?.(connectionError);
                    setIsConnected(false);

                    // EventSource will automatically try to reconnect
                    // but we should close it on fatal errors
                    if (eventSource.readyState === EventSource.CLOSED) {
                        disconnect();
                    }
                };
            } catch (err) {
                const connectionError = err instanceof Error ? err : new Error('Failed to connect to SSE');
                setError(connectionError);
                onError?.(connectionError);
            }
        };

        connect();

        return () => {
            disconnect();
        };
    }, [searchId, enabled, disconnect, onUpdate, onComplete, onError]);

    return {
        status,
        isConnected,
        error,
        disconnect,
    };
}

// Alternative hook using fetch with ReadableStream for better auth support
export function useSearchStreamFetch({
    searchId,
    enabled = true,
    onUpdate,
    onComplete,
    onError,
}: UseSearchStreamOptions): UseSearchStreamReturn {
    const [status, setStatus] = useState<SSEStatusPayload | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const disconnect = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        if (!searchId || !enabled) {
            disconnect();
            return;
        }

        const connect = async () => {
            try {
                // Get the current session token
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    throw new Error('No authentication token available');
                }

                abortControllerRef.current = new AbortController();

                const response = await fetch(getApiUrl(`/sse/${searchId}/stream`), {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/event-stream',
                    },
                    signal: abortControllerRef.current.signal,
                });

                if (!response.ok) {
                    throw new Error(`SSE request failed: ${response.status}`);
                }

                setIsConnected(true);
                setError(null);

                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('No response body');
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete messages
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data: SSEStatusPayload = JSON.parse(line.slice(6));
                                setStatus(data);
                                onUpdate?.(data);

                                if (['completed', 'failed', 'paused'].includes(data.status)) {
                                    onComplete?.(data);
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE data:', parseError);
                            }
                        } else if (line.startsWith('event: close')) {
                            // Server is closing the connection
                            disconnect();
                            return;
                        }
                    }
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    // Expected when disconnecting
                    return;
                }
                const connectionError = err instanceof Error ? err : new Error('SSE connection failed');
                setError(connectionError);
                onError?.(connectionError);
            } finally {
                setIsConnected(false);
            }
        };

        connect();

        return () => {
            disconnect();
        };
    }, [searchId, enabled, disconnect, onUpdate, onComplete, onError]);

    return {
        status,
        isConnected,
        error,
        disconnect,
    };
}

export default useSearchStream;
