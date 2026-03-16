import { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface Contact {
    id: string;
    title: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    latitude?: number;
    longitude?: number;
    rating?: number;
    reviewCount?: number;
}

interface ContactsMapDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contacts: Contact[];
    searchQuery: string;
    searchLocation: string;
}

declare global {
    interface Window {
        google: any;
    }
}

// Singleton promise so we never load the script twice
let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
    if (window.google?.maps) return Promise.resolve();
    if (googleMapsPromise) return googleMapsPromise;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return Promise.reject(new Error('Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in your .env file.'));
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
        googleMapsPromise = new Promise((resolve, reject) => {
            const check = (attempts = 0) => {
                if (window.google?.maps) return resolve();
                if (attempts > 50) return reject(new Error('Google Maps script timed out'));
                setTimeout(() => check(attempts + 1), 200);
            };
            check();
        });
        return googleMapsPromise;
    }

    googleMapsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google?.maps) resolve();
            else reject(new Error('Google Maps script loaded but API not available'));
        };
        script.onerror = () => {
            googleMapsPromise = null;
            reject(new Error('Failed to load Google Maps. Check your API key and ensure Maps JavaScript API is enabled.'));
        };
        document.head.appendChild(script);
    });

    return googleMapsPromise;
}

function buildInfoContent(contact: Contact): string {
    return `
        <div style="padding: 8px; max-width: 280px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                ${contact.title}
            </h3>
            ${contact.address ? `
                <p style="margin: 4px 0; font-size: 13px; color: #666; display: flex; align-items: start; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="min-width: 14px; margin-top: 2px;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${contact.address}</span>
                </p>
            ` : ''}
            ${contact.phone ? `
                <p style="margin: 4px 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <a href="tel:${contact.phone}" style="color: #3b82f6; text-decoration: none;">${contact.phone}</a>
                </p>
            ` : ''}
            ${contact.email ? `
                <p style="margin: 4px 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <a href="mailto:${contact.email}" style="color: #3b82f6; text-decoration: none; overflow: hidden; text-overflow: ellipsis;">${contact.email}</a>
                </p>
            ` : ''}
            ${contact.website ? `
                <p style="margin: 4px 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    <a href="${contact.website}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; overflow: hidden; text-overflow: ellipsis;">${contact.website.replace(/^https?:\/\//, '')}</a>
                </p>
            ` : ''}
            ${contact.rating ? `
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span><strong>${contact.rating}</strong> (${contact.reviewCount} reviews)</span>
                </p>
            ` : ''}
        </div>
    `;
}

export function ContactsMapDialog({
    open,
    onOpenChange,
    contacts,
    searchQuery,
    searchLocation
}: ContactsMapDialogProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Stable reference — only recalculates when contacts array identity changes
    const contactsWithCoords = useMemo(
        () => contacts.filter(
            c => typeof c.latitude === 'number' && typeof c.longitude === 'number' && !isNaN(c.latitude) && !isNaN(c.longitude)
        ),
        [contacts]
    );
    const hasValidContacts = contactsWithCoords.length > 0;

    // Store contacts in a ref so the effect doesn't depend on them
    const contactsRef = useRef(contactsWithCoords);
    contactsRef.current = contactsWithCoords;

    useEffect(() => {
        if (!open || !hasValidContacts) {
            if (!open) {
                // Cleanup when closing
                markersRef.current.forEach(m => m.setMap(null));
                markersRef.current = [];
                mapInstanceRef.current = null;
            }
            return;
        }

        let cancelled = false;

        setLoadError(null);
        setIsLoading(true);

        // Use requestAnimationFrame to ensure the div is rendered
        const rafId = requestAnimationFrame(() => {
            if (cancelled) return;

            loadGoogleMapsScript()
                .then(() => {
                    if (cancelled) return;

                    const container = mapRef.current;
                    if (!container) {
                        setLoadError('Map container not available. Please try again.');
                        setIsLoading(false);
                        return;
                    }

                    // Read from ref to get latest contacts without triggering re-runs
                    const validContacts = contactsRef.current;
                    if (validContacts.length === 0) {
                        setLoadError('No valid geographic coordinates available');
                        setIsLoading(false);
                        return;
                    }

                    // Cleanup previous instance
                    markersRef.current.forEach(m => m.setMap(null));
                    markersRef.current = [];
                    mapInstanceRef.current = null;

                    const avgLat = validContacts.reduce((sum, c) => sum + c.latitude!, 0) / validContacts.length;
                    const avgLng = validContacts.reduce((sum, c) => sum + c.longitude!, 0) / validContacts.length;

                    try {
                        mapInstanceRef.current = new window.google.maps.Map(container, {
                            center: { lat: avgLat, lng: avgLng },
                            zoom: 12,
                            styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
                            mapTypeControl: true,
                            streetViewControl: true,
                            fullscreenControl: true,
                        });
                    } catch (error) {
                        if (!cancelled) {
                            setLoadError('Failed to create map instance');
                            setIsLoading(false);
                        }
                        return;
                    }

                    const bounds = new window.google.maps.LatLngBounds();
                    const infoWindow = new window.google.maps.InfoWindow();

                    validContacts.forEach((contact, index) => {
                        const position = { lat: contact.latitude!, lng: contact.longitude! };

                        const marker = new window.google.maps.Marker({
                            position,
                            map: mapInstanceRef.current,
                            title: contact.title,
                            animation: window.google.maps.Animation.DROP,
                            label: {
                                text: String(index + 1),
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold',
                            },
                        });

                        marker.addListener('click', () => {
                            infoWindow.setContent(buildInfoContent(contact));
                            infoWindow.open(mapInstanceRef.current, marker);
                        });

                        bounds.extend(position);
                        markersRef.current.push(marker);
                    });

                    if (validContacts.length > 1) {
                        mapInstanceRef.current.fitBounds(bounds);
                    }

                    if (!cancelled) setIsLoading(false);
                })
                .catch((err) => {
                    if (!cancelled) {
                        console.error('Map load error:', err);
                        setLoadError(err.message);
                        setIsLoading(false);
                    }
                });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
        };
        // Only re-run when dialog opens/closes — NOT when contacts change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, hasValidContacts]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[85vh] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <MapPin className="h-5 w-5 text-primary" />
                        Map View
                    </DialogTitle>
                    <DialogDescription>
                        {hasValidContacts
                            ? `Showing ${contactsWithCoords.length} ${contactsWithCoords.length === 1 ? 'location' : 'locations'} for "${searchQuery}" in ${searchLocation}`
                            : 'No locations available for this search'
                        }
                    </DialogDescription>
                </DialogHeader>

                {loadError ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="rounded-full bg-destructive/10 p-4 mb-4">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">Failed to Load Map</h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">{loadError}</p>
                        <p className="mt-2 max-w-md text-xs text-muted-foreground">
                            Make sure the Google Maps JavaScript API is enabled in your Google Cloud Console.
                        </p>
                    </div>
                ) : hasValidContacts ? (
                    <div className="relative w-full h-[calc(85vh-120px)]">
                        <div ref={mapRef} className="w-full h-full" />
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading map...</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <MapPin className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No Locations Available</h3>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            The contacts in this search don't have geographic coordinates. Try a different search or wait for the current one to complete.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
