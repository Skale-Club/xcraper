import type { ReactNode } from 'react';

interface PageIntroProps {
    eyebrow: string;
    title: string;
    description: string;
    actions?: ReactNode;
}

export default function PageIntro({
    eyebrow,
    title,
    description,
    actions,
}: PageIntroProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {eyebrow}
                </p>
                <div className="space-y-1">
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
                    <p className="max-w-2xl text-sm text-slate-500">{description}</p>
                </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
    );
}
