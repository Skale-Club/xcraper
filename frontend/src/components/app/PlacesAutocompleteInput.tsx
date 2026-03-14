import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { placesApi, type PlacesSuggestion } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PlacesAutocompleteInputProps {
    id: string;
    mode: 'query' | 'location';
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    icon: LucideIcon;
    autoFocus?: boolean;
    disabled?: boolean;
    minLength?: number;
}

export function PlacesAutocompleteInput({
    id,
    mode,
    value,
    onValueChange,
    placeholder,
    icon: Icon,
    autoFocus = false,
    disabled = false,
    minLength = 3,
}: PlacesAutocompleteInputProps) {
    const listboxId = useId();
    const blurTimeoutRef = useRef<number | null>(null);
    const skipNextLookupRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);

    const trimmedValue = value.trim();
    const meetsMinLength = trimmedValue.length >= minLength;
    const isOpen = isFocused && meetsMinLength && (isLoading || suggestions.length > 0);

    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current !== null) {
                window.clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (skipNextLookupRef.current) {
            skipNextLookupRef.current = false;
            return;
        }

        if (!meetsMinLength || disabled) {
            setSuggestions([]);
            setActiveIndex(-1);
            setIsLoading(false);
            return;
        }

        let isCancelled = false;
        const timeoutId = window.setTimeout(async () => {
            try {
                setIsLoading(true);
                const response = await placesApi.autocomplete(mode, trimmedValue);

                if (isCancelled) {
                    return;
                }

                setSuggestions(response.suggestions);
                setActiveIndex(response.suggestions.length > 0 ? 0 : -1);
            } catch {
                if (!isCancelled) {
                    setSuggestions([]);
                    setActiveIndex(-1);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        }, 300);

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [disabled, meetsMinLength, mode, trimmedValue]);

    const handleSelect = (suggestion: PlacesSuggestion) => {
        skipNextLookupRef.current = true;
        onValueChange(suggestion.text);
        setSuggestions([]);
        setActiveIndex(-1);
        setIsFocused(false);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) {
            if (event.key === 'Escape') {
                setSuggestions([]);
                setActiveIndex(-1);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            return;
        }

        if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            handleSelect(suggestions[activeIndex]);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setSuggestions([]);
            setActiveIndex(-1);
            setIsFocused(false);
        }
    };

    return (
        <div className="relative">
            <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                id={id}
                type="text"
                autoFocus={autoFocus}
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                onFocus={() => {
                    if (blurTimeoutRef.current !== null) {
                        window.clearTimeout(blurTimeoutRef.current);
                    }
                    setIsFocused(true);
                }}
                onBlur={() => {
                    blurTimeoutRef.current = window.setTimeout(() => {
                        setIsFocused(false);
                    }, 120);
                }}
                onKeyDown={handleKeyDown}
                className="h-12 pl-10 pr-10 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={disabled}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls={listboxId}
            />
            {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {isOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[999] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                    <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-2">
                        {suggestions.map((suggestion, index) => (
                            <li key={`${suggestion.kind}-${suggestion.placeId ?? suggestion.text}-${index}`} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    className={cn(
                                        'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                                        index === activeIndex
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-foreground hover:bg-muted'
                                    )}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSelect(suggestion)}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {suggestion.mainText || suggestion.text}
                                        </span>
                                        {suggestion.secondaryText && (
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {suggestion.secondaryText}
                                            </span>
                                        )}
                                    </span>
                                    {value.trim().toLowerCase() === suggestion.text.trim().toLowerCase() && (
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Powered by Google
                    </div>
                </div>
            )}
        </div>
    );
}
