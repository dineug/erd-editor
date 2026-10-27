import { Theme } from '@radix-ui/themes';
import { createStore, Provider } from 'jotai';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

/**
 * Mounts an element under a Radix Theme, as the app does, in a container
 * attached to the document, where focus and the portals of menus work.
 */
export function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  act(() => root.render(createElement(Theme, null, element)));

  return {
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/**
 * Mounts a route table at one entry in a memory router, under no Theme of the
 * spec's own, since Root brings its own, and waits for the lazy routes it
 * matches to load. The routes come in, so a spec of anything else loads none.
 */
export async function renderRoutes(
  routes: RouteObject[],
  entry: string,
  store: ReturnType<typeof createStore>
) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      createElement(
        Provider,
        { store },
        createElement(RouterProvider, { router })
      )
    );
    await new Promise<void>(resolve => {
      if (router.state.initialized) return resolve();
      const unsubscribe = router.subscribe(state => {
        if (!state.initialized) return;
        unsubscribe();
        resolve();
      });
    });
  });

  return {
    container,
    router,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      router.dispose();
    },
  };
}

/** Lets pending timers and the renders they cause run. */
export async function flushTimers() {
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
}

/** Dispatches a keydown the way a browser does, bubbling and cancelable. */
export function pressKey(target: Element, key: string) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
  });
}
