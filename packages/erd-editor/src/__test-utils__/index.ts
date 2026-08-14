import {
  DOMTemplateLiterals,
  nextTick,
  render,
  useProvider,
} from '@dineug/r-html';

import {
  AppContext,
  appContext,
  createAppContext,
} from '@/components/appContext';
import { RxStoreOptions } from '@/engine/rx-store';

/**
 * Test-only helpers. Not shipped — excluded from coverage in vitest.config.ts.
 */

export function createTestAppContext(options?: RxStoreOptions): AppContext {
  return createAppContext({ toWidth: text => text.length * 10 }, options);
}

/** Let the r-html scheduler and pending microtasks drain. */
export async function flush(ticks = 3) {
  for (let i = 0; i < ticks; i++) {
    await nextTick(() => {});
    await Promise.resolve();
  }
}

export type Mounted = {
  container: HTMLDivElement;
  app: AppContext;
  unmount: () => void;
};

/**
 * Mounts a template into a container attached to `document.body`, providing
 * `appContext` from the container so any child that calls `useAppContext`
 * resolves it through the normal context event flow.
 */
export function mount(
  template: DOMTemplateLiterals,
  app: AppContext = createTestAppContext()
): Mounted {
  const container = document.createElement('div');
  document.body.append(container);

  // `useProvider` accepts a bare HTMLElement at runtime (`ctx instanceof HTMLElement`)
  // but its public type only admits a component context, hence the cast.
  // It is also r-html's useProvider, not a React hook — the rule cannot tell them apart.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(container as any, appContext, app);
  render(container, template);

  return {
    container,
    app,
    unmount: () => {
      render(container, null);
      provider.destroy();
      container.remove();
    },
  };
}

/** Mount, then wait for the first render to settle. */
export async function mountAndFlush(
  template: DOMTemplateLiterals,
  app?: AppContext
): Promise<Mounted> {
  const mounted = mount(template, app);
  await flush();
  return mounted;
}
