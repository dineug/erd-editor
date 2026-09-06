import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

/**
 * A static import of ELK, which is evaluated before any statement in the file
 * that writes it and so before the realm stub. The type-only import of the api
 * carries no runtime import at all, so it is not one of these.
 */
const STATIC_ELK_IMPORT = /^import\s+(?!type\s)[^;]*'elkjs\/[^']*'/gm;

/** A dynamic import, which runs where it is written and not before. */
const DYNAMIC_ELK_IMPORT = /import\(\s*'elkjs\/[^']*'\s*\)/;

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

describe('the realm stub runs before ELK does', () => {
  it('stubs a document only where the realm has none', async () => {
    const stubbed = typeof document === 'undefined';

    await import('@/services/elk-layout/elkWorkerRealm');

    expect(typeof document).toBe('object');
    expect(stubbed).toBe(false);
  });

  it('leaves no static ELK import in any shipped file', () => {
    const importers = sourceFiles(SOURCE_ROOT)
      .filter(path => !/\.test\.tsx?$/.test(path))
      .filter(path => STATIC_ELK_IMPORT.test(readFileSync(path, 'utf8')))
      .map(posix)
      .sort();

    expect(importers).toEqual([]);
  });

  it('reaches ELK from the service, after the stub that file imports', () => {
    const service = readFileSync(
      join(SOURCE_ROOT, 'services', 'elk-layout', 'elkLayoutService.ts'),
      'utf8'
    );

    expect(service).toContain("import '@/services/elk-layout/elkWorkerRealm'");
    expect(DYNAMIC_ELK_IMPORT.test(service)).toBe(true);
  });
});
