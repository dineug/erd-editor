import { describe, expect, it } from 'vite-plus/test';

import { rHtmlJsx } from './plugin';

type TransformResult = { code: string } | undefined | null;

const run = (
  code: string,
  id: string,
  options?: Parameters<typeof rHtmlJsx>[0]
): TransformResult => {
  const plugin = rHtmlJsx(options);
  const hook: any = plugin.transform;
  const handler = typeof hook === 'function' ? hook : hook.handler;
  return handler.call({}, code, id);
};

describe('rHtmlJsx', () => {
  it('runs before vite:oxc, because it needs the JSX still there', () => {
    expect(rHtmlJsx().enforce).toBe('pre');
  });

  it('compiles a .tsx', () => {
    const result = run('const a = <div class="x" />;', '/src/A.tsx');
    expect(result?.code).toContain('__rHtml`<div class="x" />`');
  });

  it('leaves a .ts alone even when it parses as JSX-free TypeScript', () => {
    expect(run('const a = 1;', '/src/a.ts')).toBeUndefined();
  });

  it('returns nothing for a .tsx with no JSX, so the file is not re-emitted', () => {
    expect(run('export const a = 1;', '/src/a.tsx')).toBeUndefined();
  });

  it('sees through a query suffix', () => {
    const result = run('const a = <div />;', '/src/A.tsx?v=abc123');
    expect(result?.code).toContain('__rHtml`<div />`');
  });

  it('skips node_modules by default', () => {
    expect(
      run('const a = <div />;', '/x/node_modules/y/A.tsx')
    ).toBeUndefined();
  });

  it('honours an explicit include', () => {
    const options = { include: /keep\.tsx$/ };
    expect(run('const a = <div />;', '/src/skip.tsx', options)).toBeUndefined();
    expect(run('const a = <div />;', '/src/keep.tsx', options)?.code).toContain(
      '__rHtml`<div />`'
    );
  });

  it('passes the import source through', () => {
    const result = run('const a = <div />;', '/src/A.tsx', {
      importSource: '@scope/pkg',
    });
    expect(result?.code).toContain("from '@scope/pkg'");
  });
});
