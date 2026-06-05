import { useMemo, useState, type KeyboardEvent } from 'react';
import { Label } from '@/components/ui/label';
import { X, ChevronDown } from 'lucide-react';
import type { ScraperFormField, ScraperFormFieldOption } from '@/lib/api';

interface ScraperFilterFieldsProps {
    schema: ScraperFormField[];
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    disabled?: boolean;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function TagsInput({
    value,
    placeholder,
    disabled,
    onChange,
}: {
    value: string[];
    placeholder?: string;
    disabled?: boolean;
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');

    const addTag = (raw: string) => {
        const tag = raw.trim();
        if (tag && !value.includes(tag)) {
            onChange([...value, tag]);
        }
        setDraft('');
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTag(draft);
        } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring">
            {value.map((tag) => (
                <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                    {tag}
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((t) => t !== tag))}
                            className="rounded-full hover:text-primary/70"
                            aria-label={`Remove ${tag}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </span>
            ))}
            <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => draft.trim() && addTag(draft)}
                placeholder={value.length === 0 ? placeholder : ''}
                disabled={disabled}
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
        </div>
    );
}

function ChipSelect({
    options,
    value,
    multi,
    disabled,
    onChange,
}: {
    options: { value: string; label: string }[];
    value: string[];
    multi: boolean;
    disabled?: boolean;
    onChange: (next: string[]) => void;
}) {
    const toggle = (optValue: string) => {
        if (value.includes(optValue)) {
            onChange(value.filter((v) => v !== optValue));
        } else {
            onChange(multi ? [...value, optValue] : [optValue]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const selected = value.includes(opt.value);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(opt.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                            selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

function Combobox({
    options,
    value,
    placeholder,
    disabled,
    onChange,
}: {
    options: ScraperFormFieldOption[];
    value: string[];
    placeholder?: string;
    disabled?: boolean;
    onChange: (next: string[]) => void;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);

    const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

    const filtered = useMemo(() => {
        const selected = new Set(value);
        const q = query.trim().toLowerCase();
        const base = options.filter((o) => !selected.has(o.value));
        const matches = q
            ? base.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
            : base;
        return matches.slice(0, 50);
    }, [options, value, query]);

    const addValue = (v: string) => {
        if (!value.includes(v)) onChange([...value, v]);
        setQuery('');
    };

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((v) => (
                        <span
                            key={v}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                        >
                            {labelFor(v)}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onChange(value.filter((x) => x !== v))}
                                    className="rounded-full hover:text-primary/70"
                                    aria-label={`Remove ${labelFor(v)}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}
            <div className="relative">
                <div className="flex items-center rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                    <input
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 120)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                    />
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                {open && filtered.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-background py-1 shadow-lg">
                        {filtered.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                // onMouseDown so the option is picked before the input blur closes the list
                                onMouseDown={(e) => { e.preventDefault(); addValue(o.value); }}
                                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ScraperFilterFields({ schema, values, onChange, disabled }: ScraperFilterFieldsProps) {
    return (
        <div className="space-y-5">
            {schema.map((field) => (
                <div key={field.key} className="space-y-2">
                    <Label htmlFor={`filter-${field.key}`} className="text-sm font-semibold text-foreground">
                        {field.label}
                    </Label>

                    {field.type === 'text' && (
                        <input
                            id={`filter-${field.key}`}
                            type="text"
                            value={typeof values[field.key] === 'string' ? (values[field.key] as string) : ''}
                            onChange={(e) => onChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                        />
                    )}

                    {field.type === 'number' && (
                        <input
                            id={`filter-${field.key}`}
                            type="number"
                            value={typeof values[field.key] === 'number' ? (values[field.key] as number) : ''}
                            onChange={(e) => onChange(field.key, e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                        />
                    )}

                    {field.type === 'tags' && (
                        <TagsInput
                            value={asStringArray(values[field.key])}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            onChange={(next) => onChange(field.key, next)}
                        />
                    )}

                    {(field.type === 'multiselect' || field.type === 'select') && field.options && (
                        <ChipSelect
                            options={field.options}
                            value={asStringArray(values[field.key])}
                            multi={field.type === 'multiselect'}
                            disabled={disabled}
                            onChange={(next) => onChange(field.key, next)}
                        />
                    )}

                    {field.type === 'combobox' && field.options && (
                        <Combobox
                            options={field.options}
                            value={asStringArray(values[field.key])}
                            placeholder={field.placeholder}
                            disabled={disabled}
                            onChange={(next) => onChange(field.key, next)}
                        />
                    )}

                    {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
