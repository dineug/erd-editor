import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { TEMPLATE_LITERALS } from '@/constants';
import { TemplateLiteralsType } from '@/template';
import type { CSS } from '@/template/css';
import type { CSSDiagnosticHandler } from '@/template/cssDiagnostics';

let css: CSS;
let addCSSHost: (host: ShadowRoot) => void;
let setCSSDiagnostics: (value: boolean | CSSDiagnosticHandler | null) => void;

const createHost = (): ShadowRoot => {
  const host = document.createElement('div');
  document.body.append(host);
  return host.attachShadow({ mode: 'open' });
};

const rulesOf = (host: ShadowRoot): string[] =>
  host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );

const selectorsOf = (host: ShadowRoot): string[] =>
  rulesOf(host).map(text => text.slice(0, text.indexOf('{')).trim());

beforeEach(async () => {
  vi.resetModules();
  css = (await import('@/template/css')).css;
  addCSSHost = (await import('@/template/vCSSStyleSheet')).addCSSHost;
  setCSSDiagnostics = (await import('@/template/cssDiagnostics'))
    .setCSSDiagnostics;
});

describe('template/css.global', () => {
  describe('shape', () => {
    it('is a property of the css tag, not a separate export', () => {
      expect(typeof css.global).toBe('function');
      expect(css.global).not.toBe(css);
    });

    it('produces a literal tagged as css, reusing the same enum member', () => {
      const tpl = css.global`
        .a {
          color: red;
        }
      `;

      expect(tpl[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.css);
      expect(Object.values(TemplateLiteralsType)).toHaveLength(3);
    });

    it('stringifies to a content hash the same way a scoped literal does', () => {
      const tpl = css.global`
        .a {
          color: red;
        }
      `;

      expect(String(tpl)).toMatch(/^_[0-9a-z]{7}$/);
      expect(`${tpl}`).toBe(tpl.toString());
    });

    it('freezes the template and marks the node global', () => {
      const tpl = css.global`
        .a {
          color: red;
        }
      `;

      expect(Object.isFrozen(tpl.template)).toBe(true);
      expect(tpl.template.node.mode).toBe('global');
    });

    it('leaves the scoped tag on the scoped mode', () => {
      const tpl = css`
        color: red;
      `;

      expect(tpl.template.node.mode).toBe('scoped');
    });
  });

  describe('no scope is attached', () => {
    it('keeps a class selector literal', () => {
      const host = createHost();
      css.global`
        .scrollbar {
          scrollbar-width: thin;
        }
      `;
      addCSSHost(host);

      expect(rulesOf(host)).toEqual(['.scrollbar { scrollbar-width: thin; }']);
    });

    it('keeps :host unscoped', () => {
      const host = createHost();
      css.global`
        :host {
          --text-font-family: serif;
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual([':host']);
    });

    it('keeps a webkit scrollbar pseudo element unscoped', () => {
      const host = createHost();
      css.global`
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: red;
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual([
        '::-webkit-scrollbar',
        '::-webkit-scrollbar-thumb:hover',
      ]);
    });

    it('keeps the universal selector list unscoped', () => {
      const host = createHost();
      css.global`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual(['*,*::before,*::after']);
    });

    it('keeps a bare type selector list unscoped', () => {
      const host = createHost();
      css.global`
        button,
        input,
        select,
        textarea {
          padding: 0;
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual(['button,input,select,textarea']);
    });

    it('still nests, and nests without a scope', () => {
      const host = createHost();
      css.global`
        .a {
          color: red;

          &:hover {
            color: blue;
          }

          .b {
            color: green;
          }
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual(['.a', '.a:hover', '.a .b']);
    });

    it('scopes the same source when the scoped tag compiles it', () => {
      const host = createHost();
      const tpl = css`
        :host {
          color: red;
        }
      `;
      addCSSHost(host);

      expect(selectorsOf(host)).toEqual([`.${String(tpl)} :host`]);
    });
  });

  describe('bare declarations', () => {
    it('drops them, because a global block has no selector to give them', () => {
      const host = createHost();
      css.global`
        color: red;
        .a {
          color: blue;
        }
      `;
      addCSSHost(host);

      expect(rulesOf(host)).toEqual(['.a { color: blue; }']);
    });
  });

  describe('diagnostics', () => {
    const collect = (compile: () => void) => {
      const seen: string[] = [];
      setCSSDiagnostics(diagnostic => seen.push(diagnostic.code));
      compile();
      setCSSDiagnostics(false);
      return seen;
    };

    it('stays silent on :host, which is simply correct here', () => {
      expect(
        collect(() => {
          css.global`
            :host {
              color: red;
            }
          `;
        })
      ).toEqual([]);
    });

    it('stays silent on ::slotted', () => {
      expect(
        collect(() => {
          css.global`
            ::slotted(span) {
              color: red;
            }
          `;
        })
      ).toEqual([]);
    });

    it('stays silent on a leading pseudo class', () => {
      expect(
        collect(() => {
          css.global`
            :hover {
              color: red;
            }
          `;
        })
      ).toEqual([]);
    });

    it('reports the same two selectors when the scoped tag compiles them', () => {
      expect(
        collect(() => {
          css`
            :host {
              color: red;
            }
            :hover {
              color: blue;
            }
          `;
        })
      ).toEqual(['shadow-boundary', 'implicit-descendant']);
    });

    it('still reports a dropped top level declaration', () => {
      expect(
        collect(() => {
          css.global`
            color: red;
            .a {
              color: blue;
            }
          `;
        })
      ).toEqual(['rule-without-selector']);
    });

    it('still reports an unsupported statement at-rule', () => {
      expect(
        collect(() => {
          css.global`
            @import url('a.css');
            .a {
              color: red;
            }
          `;
        })
      ).toEqual(['unsupported-at-rule']);
    });
  });
});
