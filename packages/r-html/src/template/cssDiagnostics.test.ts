import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Diagnostic } from '@/css';
import type { CSS } from '@/template/css';
import type {
  CSSDiagnosticContext,
  CSSDiagnosticHandler,
} from '@/template/cssDiagnostics';

const AMBIENT_FLAG = '__RHTML_CSS_DIAGNOSTICS__';

let css: CSS;
let setCSSDiagnostics: (value: boolean | CSSDiagnosticHandler | null) => void;
let isCSSDiagnosticsEnabled: () => boolean;

/** A single source with two findings, so ordering and count are both observable. */
const compileBadSource = () => css`
  :host {
    color: red;
  }
  :hover {
    color: blue;
  }
`;

async function loadModules() {
  vi.resetModules();
  css = (await import('@/template/css')).css;
  const diagnostics = await import('@/template/cssDiagnostics');
  setCSSDiagnostics = diagnostics.setCSSDiagnostics;
  isCSSDiagnosticsEnabled = diagnostics.isCSSDiagnosticsEnabled;
}

beforeEach(async () => {
  Reflect.deleteProperty(globalThis, AMBIENT_FLAG);
  await loadModules();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, AMBIENT_FLAG);
  vi.restoreAllMocks();
});

describe('template/cssDiagnostics', () => {
  describe('default state', () => {
    it('is off, so nothing is collected and nothing is reported', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(isCSSDiagnosticsEnabled()).toBe(false);
      compileBadSource();

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('setCSSDiagnostics', () => {
    it('true installs the console handler', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setCSSDiagnostics(true);
      expect(isCSSDiagnosticsEnabled()).toBe(true);
      compileBadSource();

      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0][0]).toContain('[r-html] css _');
      expect(warn.mock.calls[0][0]).toContain('shadow-boundary');
    });

    it('routes an error severity to console.error', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      setCSSDiagnostics(true);
      css`
        @import url('a.css');
        color: red;
      `;

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain('unsupported-at-rule');
    });

    it('names the tag and the line in the console message', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      setCSSDiagnostics(true);
      css.global`
        color: red;
        .a {
          color: blue;
        }
      `;

      // `rule-without-selector` at the top level of a global block carries no position.
      expect(warn.mock.calls[0][0]).toContain('[r-html] css.global _');
      expect(warn.mock.calls[0][0]).toContain('rule-without-selector');
    });

    it('a function receives every diagnostic with the source and the identifier', () => {
      const seen: Array<[Diagnostic, CSSDiagnosticContext]> = [];
      setCSSDiagnostics((diagnostic, context) =>
        seen.push([diagnostic, context])
      );

      const tpl = compileBadSource();

      expect(seen.map(([diagnostic]) => diagnostic.code)).toEqual([
        'shadow-boundary',
        'implicit-descendant',
      ]);
      expect(seen[0][1].identifier).toBe(String(tpl));
      expect(seen[0][1].mode).toBe('scoped');
      expect(seen[0][1].source).toContain(':host');
      expect(seen[0][0].line).toBe(2);
    });

    it('false turns it back off', () => {
      const seen: string[] = [];
      setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));
      setCSSDiagnostics(false);

      compileBadSource();

      expect(isCSSDiagnosticsEnabled()).toBe(false);
      expect(seen).toEqual([]);
    });
  });

  describe('ambient flag', () => {
    it('turns diagnostics on without a call, and is read lazily', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(isCSSDiagnosticsEnabled()).toBe(false);

      Reflect.set(globalThis, AMBIENT_FLAG, true);

      expect(isCSSDiagnosticsEnabled()).toBe(true);
      compileBadSource();
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('accepts a handler function directly', () => {
      const seen: string[] = [];
      Reflect.set(globalThis, AMBIENT_FLAG, (diagnostic: Diagnostic) =>
        seen.push(diagnostic.code)
      );

      compileBadSource();

      expect(seen).toEqual(['shadow-boundary', 'implicit-descendant']);
    });

    it('is overridden by an explicit false', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      Reflect.set(globalThis, AMBIENT_FLAG, true);
      setCSSDiagnostics(false);

      compileBadSource();

      expect(warn).not.toHaveBeenCalled();
    });

    it('is restored by passing null', () => {
      Reflect.set(globalThis, AMBIENT_FLAG, true);
      setCSSDiagnostics(false);
      expect(isCSSDiagnosticsEnabled()).toBe(false);

      setCSSDiagnostics(null);

      expect(isCSSDiagnosticsEnabled()).toBe(true);
    });
  });

  describe('reporting cadence', () => {
    it('reports once per distinct compilation, not once per call', () => {
      const seen: string[] = [];
      setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));

      const tag = (value: string) => css`
        :hover {
          color: ${value};
        }
      `;
      tag('red');
      tag('red');

      expect(seen).toEqual(['implicit-descendant']);
    });

    it('reports again when the same call site compiles a new value set', () => {
      const seen: string[] = [];
      setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));

      const tag = (value: string) => css`
        :hover {
          color: ${value};
        }
      `;
      tag('red');
      tag('blue');

      expect(seen).toEqual(['implicit-descendant', 'implicit-descendant']);
    });

    it('does not re-report a template that compiled while it was off', () => {
      const tag = (value: string) => css`
        :hover {
          color: ${value};
        }
      `;
      tag('red');

      const seen: string[] = [];
      setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));
      tag('red');

      expect(seen).toEqual([]);
    });
  });
});
