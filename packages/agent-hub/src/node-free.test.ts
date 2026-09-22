/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test';

import ownSource from './node-free.test.ts?raw';

// Read through the bundler rather than node:fs, since this file is scanned
// too. A glob never matches the file that declares it, hence the raw import.
const sources: Record<string, string> = {
  ...import.meta.glob<string>('./**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  './node-free.test.ts': ownSource,
};

const NODE_IMPORT = /\b(?:from|import|require)\s*\(?\s*['"]node:/;
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

describe('agent-hub stays free of node builtins', () => {
  it('scans every TypeScript file under src, tests included', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([
        './discovery.ts',
        './framing.ts',
        './index.ts',
        './lock.ts',
        './paths.ts',
        './protocol.ts',
        './node-free.test.ts',
      ])
    );
  });

  it('has no node: import in any file', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => NODE_IMPORT.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('imports only its own modules outside tests, so no bare builtin slips in either', () => {
    const bare = Object.entries(sources)
      .filter(([path]) => !path.endsWith('.test.ts'))
      .flatMap(([path, source]) =>
        [...source.matchAll(SPECIFIER)]
          .map(match => match[1])
          .filter(
            specifier =>
              !specifier.startsWith('./') && !specifier.startsWith('@/')
          )
          .map(specifier => `${path}: ${specifier}`)
      );

    expect(bare).toEqual([]);
  });

  it('recognizes every import form it guards against', () => {
    const prefix = 'node';

    for (const statement of [
      `import { readFile } from '${prefix}:fs';`,
      `import '${prefix}:net';`,
      `const os = await import("${prefix}:os");`,
      `const path = require('${prefix}:path');`,
      `export { join } from '${prefix}:path';`,
    ]) {
      expect(NODE_IMPORT.test(statement)).toBe(true);
    }
    expect(NODE_IMPORT.test(`import { node } from './node';`)).toBe(false);
  });
});
