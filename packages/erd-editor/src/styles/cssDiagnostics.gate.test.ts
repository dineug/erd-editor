/// <reference types="vite/client" />
import { css, Diagnostic, setCSSDiagnostics } from '@dineug/r-html';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

const styleModules: Record<string, () => Promise<unknown>> = {
  ...import.meta.glob('../**/*.styles.ts'),
  ...import.meta.glob('../**/*.style.ts'),
  // The one shipped module that declares a css template without being named *.styles.ts.
  // emittedCss.cascade.test.ts carries the guard that keeps this list honest.
  '../utils/text.ts': () => import('@/utils/text'),
};

const modulePaths = Object.keys(styleModules).sort();

type Finding = { path: string; diagnostic: Diagnostic };

const findings: Finding[] = [];

beforeAll(async () => {
  let current = '';
  setCSSDiagnostics(diagnostic => findings.push({ path: current, diagnostic }));

  for (const path of modulePaths) {
    current = path;
    await styleModules[path]();
  }
});

afterAll(() => {
  setCSSDiagnostics(false);
});

describe('css diagnostics gate', () => {
  it('covers every style module in the package', () => {
    expect(modulePaths).toHaveLength(63);
  });

  it('reports nothing for the whole style surface', () => {
    const rendered = findings.map(
      ({ path, diagnostic }) =>
        `${path}${diagnostic.line === undefined ? '' : `:${diagnostic.line}:${diagnostic.column}`} ${diagnostic.severity} ${diagnostic.code} — ${diagnostic.message}`
    );

    expect(rendered).toEqual([]);
  });

  it('is actually listening', () => {
    // Guards against the gate passing because diagnostics were never switched on: a known-bad
    // source has to produce a finding through the same handler the loop above used.
    const seen: string[] = [];
    setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));

    css`
      :host {
        color: red;
      }
    `;

    setCSSDiagnostics(false);
    expect(seen).toEqual(['shadow-boundary']);
  });
});
