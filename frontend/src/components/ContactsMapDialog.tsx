import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Loader2 } from 'lucide-react';

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

// Declare google maps types
declare global {
    interface Window {
        google: any;
        initMap: () => void;
    }
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
    const isScriptLoadedRef = useRef(false);

    // Filter contacts with valid coordinates
    const contactsWithCoords = contacts.filter(c => c.latitude && c.longitude);
    const hasValidContacts = contactsWithCoords.length > 0;

    useEffect(() => {
        if (!open || !hasValidContacts) return;

        // Load Google Maps script if not already loaded
        const loadGoogleMapsScript = () => {
            if (isScriptLoadedRef.current || window.google?.maps) {
                initializeMap();
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                isScriptLoadedRef.current = true;
                initializeMap();
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            if (!mapRef.current || !window.google?.maps) return;

            // Clear existing markers
            markersRef.current.forEach(marker => marker.setMap(null));
            markersRef.current = [];

            // Calculate center point (average of all coordinates)
            const avgLat = contactsWithCoords.reduce((sum, c) => sum + (c.latitude || 0), 0) / contactsWithCoords.length;
            const avgLng = contactsWithCoords.reduce((sum, c) => sum + (c.longitude || 0), 0) / contactsWithCoords.length;

            // Create or update map
            if (!mapInstanceRef.current) {
                mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                    center: { lat: avgLat, lng: avgLng },
                    zoom: 12,
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'off' }]
                        }
                    ],
                    mapTypeControl: true,
                    streetViewControl: true,
                    fullscreenControl: true,
                });
            } else {
                mapInstanceRef.current.setCenter({ lat: avgLat, lng: avgLng });
            }

            // Add markers for each contact
            const bounds = new window.google.maps.LatLngBounds();
            const infoWindow = new window.google.maps.InfoWindow();

            contactsWithCoords.forEach((contact, index) => {
                const position = {
                    lat: contact.latitude!,
                    lng: contact.longitude!
                };

                const marker = new window.google.maps.Marker({
                    position,
                    map: mapInstanceRef.current,
                    title: contact.title,
                    animation: window.google.maps.Animation.DROP,
                    label: {
                        text: String(index + 1),
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }
                });

                // Create info window content
                const infoContent = `
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

                marker.addListener('click', () => {
                    infoWindow.setContent(infoContent);
                    infoWindow.open(mapInstanceRef.current, marker);
                });

                bounds.extend(position);
                markersRef.current.push(marker);
            });

            // Fit map to show all markers
            if (contactsWithCoords.length > 1) {
                mapInstanceRef.current.fitBounds(bounds);
            }
        };

        loadGoogleMapsScript();
    }, [open, contactsWithCoords, hasValidContacts]);

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

                {hasValidContacts ? (
                    <div className="relative w-full h-[calc(85vh-120px)]">
                        <div ref={mapRef} className="w-full h-full" />

                        {/* Loading overlay */}
                        {!mapInstanceRef.current && (
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
