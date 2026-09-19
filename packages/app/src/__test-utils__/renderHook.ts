import { createStore, Provider } from 'jotai';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

type Store = ReturnType<typeof createStore>;

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

/**
 * Mounts a hook under a jotai Provider for the given store and hands back what
 * it last returned.
 */
export function renderHook<T>(hook: () => T, store: Store) {
  const result = { current: undefined as T };
  const root = createRoot(document.createElement('div'));

  function Probe() {
    result.current = hook();
    return null;
  }

  const render = () =>
    act(() => {
      root.render(createElement(Provider, { store }, createElement(Probe)));
    });

  render();

  return {
    result,
    rerender: render,
    unmount: () => act(() => root.unmount()),
  };
}
