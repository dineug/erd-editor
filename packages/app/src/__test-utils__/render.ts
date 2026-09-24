import { Theme } from '@radix-ui/themes';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

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
