import { describe, expect, it } from 'vite-plus/test';

import type { RefreshOptions } from './options';
import { rHtmlRefresh } from './refresh';

const run = (code: string, id = '/src/A.ts', options?: RefreshOptions) => {
  const plugin = rHtmlRefresh(options);
  const hook: any = plugin.transform;
  const handler = typeof hook === 'function' ? hook : hook.handler;
  return handler.call({}, code, id) as Promise<{ code: string } | undefined>;
};

const COMPONENT = 'const A = () => {};\n';

describe('rHtmlRefresh', () => {
  it('accepts a module whose default export is a component identifier', async () => {
    const result = await run(`${COMPONENT}export default A;`);
    expect(result?.code).toContain('originComponent: A');
    expect(result?.code).toContain("new CustomEvent('hmr:r-html'");
  });

  it('names a default-exported function declaration', async () => {
    // `.name` is undefined on a FunctionDeclaration — reading only that used to
    // inject `originComponent: undefined`, which self-accepts the module and
    // then swallows the update instead of swapping or reloading.
    const result = await run('export default function A() {}');
    expect(result?.code).toContain('originComponent: A');
  });

  it('declines an anonymous default export rather than self-accepting it', async () => {
    await expect(run('export default () => {};')).resolves.toBeUndefined();
  });

  it('leaves a module with no default export alone', async () => {
    await expect(run('export const A = () => {};')).resolves.toBeUndefined();
  });

  it('skips a module that is not a boundary', async () => {
    const source = `export const size = 1;\n${COMPONENT}export default A;`;
    await expect(run(source)).resolves.toBeUndefined();
  });

  it('treats component-shaped named exports as a boundary', async () => {
    const source = `${COMPONENT}export { A };\nexport default A;`;
    expect((await run(source))?.code).toContain('originComponent: A');
  });

  it('treats a component-shaped function declaration export as a boundary', async () => {
    const source = 'export function A() {}\nexport default A;';
    expect((await run(source))?.code).toContain('originComponent: A');
  });

  it('rejects a lowercase re-export specifier', async () => {
    const source = `const a = 1;\n${COMPONENT}export { a };\nexport default A;`;
    await expect(run(source)).resolves.toBeUndefined();
  });

  it('never parses a module without an export default', async () => {
    // Invalid syntax: reaching Babel at all would throw. Returning quietly is
    // the proof that the cheap pre-filter ran first.
    await expect(run('this is not javascript at all')).resolves.toBeUndefined();
  });

  it('honours exclude', async () => {
    const source = `${COMPONENT}export default A;`;
    await expect(
      run(source, '/x/node_modules/y/A.ts')
    ).resolves.toBeUndefined();
  });

  it('honours include', async () => {
    const source = `${COMPONENT}export default A;`;
    const options: RefreshOptions = { include: /keep\.ts$/ };
    await expect(run(source, '/src/skip.ts', options)).resolves.toBeUndefined();
    expect((await run(source, '/src/keep.ts', options))?.code).toContain(
      'originComponent: A'
    );
  });
});
