import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for docs/DOMAIN-CHANGE.md: moving Xcraper to a new domain
 * must stay a configuration change. No application source may carry a literal
 * production domain; the only allowed home is the defaults in
 * backend/src/config/urls.ts.
 *
 * When the production domain changes, add the new one to FORBIDDEN and keep
 * the old one, so nothing slips back in.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

const ROOTS = ['backend/src', 'frontend/src', 'frontend/index.html', 'api'];

// Files allowed to hold a literal (relative to the repo root, forward slashes).
const ALLOWED = new Set(['backend/src/config/urls.ts']);

const SKIP_DIRS = new Set(['node_modules', 'dist', '__fixtures__']);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|html|css|json|xml|txt)$/;

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
    { name: 'xcraper.skale.club', pattern: /xcraper\.skale\.club/i },
    // `skale.club@gmail.com` is the super-admin e-mail address, not a host.
    { name: 'skale.club (host)', pattern: /skale\.club(?!@)/i },
    { name: 'xphere.app', pattern: /xphere\.app/i },
    { name: '*.vercel.app', pattern: /[a-z0-9-]+\.vercel\.app/i },
];

function collect(target: string, out: string[]): void {
    const stat = statSync(target);
    if (stat.isFile()) {
        if (SOURCE_EXT.test(target)) out.push(target);
        return;
    }
    for (const entry of readdirSync(target)) {
        if (SKIP_DIRS.has(entry)) continue;
        collect(path.join(target, entry), out);
    }
}

function isTestFile(rel: string): boolean {
    return /\.(test|spec)\.[tj]sx?$/.test(rel);
}

describe('no production domain literals outside the URL config', () => {
    const files: string[] = [];
    for (const root of ROOTS) collect(path.join(REPO_ROOT, root), files);

    it('scans a plausible number of files', () => {
        // Guards against the scan silently covering nothing (wrong root, moved dirs).
        expect(files.length).toBeGreaterThan(50);
    });

    it('finds none', () => {
        const offenders: string[] = [];
        for (const file of files) {
            const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
            if (ALLOWED.has(rel) || isTestFile(rel)) continue;

            const lines = readFileSync(file, 'utf8').split(/\r?\n/);
            lines.forEach((line, index) => {
                for (const { name, pattern } of FORBIDDEN) {
                    if (pattern.test(line)) offenders.push(`${rel}:${index + 1} contains ${name}`);
                }
            });
        }
        expect(offenders, `Move these into backend/src/config/urls.ts or env:\n${offenders.join('\n')}`).toEqual([]);
    });
});
