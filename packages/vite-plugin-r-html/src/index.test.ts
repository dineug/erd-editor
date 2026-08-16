import { describe, expect, it } from 'vite-plus/test';

import { rHtml } from './index';

const names = (plugins: { name: string }[]) => plugins.map(p => p.name);

describe('rHtml', () => {
  it('returns both halves, JSX first', () => {
    expect(names(rHtml())).toEqual(['vite:r-html-jsx', 'vite:r-html-refresh']);
  });

  it('pins the ordering each half needs, so the caller cannot get it wrong', () => {
    const [jsx, refresh] = rHtml();
    expect(jsx.enforce).toBe('pre');
    expect(refresh.enforce).toBeUndefined();
    expect(refresh.apply).toBe('serve');
  });

  it('drops a half turned off', () => {
    expect(names(rHtml({ jsx: false }))).toEqual(['vite:r-html-refresh']);
    expect(names(rHtml({ refresh: false }))).toEqual(['vite:r-html-jsx']);
    expect(rHtml({ jsx: false, refresh: false })).toEqual([]);
  });

  it('shares top-level options with both halves', () => {
    const [jsx] = rHtml({ exclude: /skip/, importSource: 'x' });
    const hook: any = jsx.transform;
    const handler = typeof hook === 'function' ? hook : hook.handler;

    expect(
      handler.call({}, 'const a = <div />;', '/skip/A.tsx')
    ).toBeUndefined();
    expect(
      handler.call({}, 'const a = <div />;', '/keep/A.tsx')?.code
    ).toContain("from 'x'");
  });

  it('lets one half narrow itself without touching the other', () => {
    const [jsx] = rHtml({ jsx: { importSource: 'only-jsx' } });
    const hook: any = jsx.transform;
    const handler = typeof hook === 'function' ? hook : hook.handler;

    expect(
      handler.call({}, 'const a = <div />;', '/src/A.tsx')?.code
    ).toContain("from 'only-jsx'");
  });
});
