import {
  DOMTemplateLiterals,
  nextTick,
  render,
  useProvider,
} from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import {
  AppContext,
  appContext,
  createAppContext,
} from '@/components/appContext';
import { RxStoreOptions } from '@/engine/rx-store';
import { type Theme, ThemeTokens } from '@/themes/tokens';

/**
 * Test-only helpers. Not shipped — excluded from coverage in vitest.config.ts.
 */

export function createTestAppContext(options?: RxStoreOptions): AppContext {
  return createAppContext({ toWidth: text => text.length * 10 }, options);
}

/**
 * One distinct, valid colour per token, so an assertion on a painted scene node
 * names the token it means instead of matching a shade two tokens also carry.
 */
export function createTestTheme(): Theme {
  return ThemeTokens.reduce<Theme>((theme, token, index) => {
    Reflect.set(theme, token, `#${(index + 1).toString(16).padStart(6, '0')}`);
    return theme;
  }, {} as Theme);
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
 * Mounts a template into a container attached to document.body, providing
 * appContext from the container so any child that calls useAppContext
 * resolves it through the normal context event flow.
 */
export function mount(
  template: DOMTemplateLiterals,
  app: AppContext = createTestAppContext()
): Mounted {
  const container = document.createElement('div');
  document.body.append(container);

  // useProvider takes a bare HTMLElement at runtime but types only a component
  // context, hence the cast; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
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

/** A scene node as a spec drives one: konva's own dispatch, nothing more. */
export type SceneEventTarget = {
  fire(type: string, evt?: any, bubble?: boolean): unknown;
};

/**
 * A pointer event delivered the way konva delivers one. The window streams that
 * feed drag$ see the same native event, because the browser event a stage
 * listener runs on is the one that goes on to reach the window.
 */
export function fireScenePointer(
  node: SceneEventTarget,
  type: string,
  init: MouseEventInit = {}
): MouseEvent {
  const evt = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(evt);
  node.fire(type, { evt }, true);
  return evt;
}

/** The touch half of fireScenePointer, with the one touch drag$ accepts. */
export function fireSceneTouch(
  node: SceneEventTarget,
  type: string,
  clientX = 0,
  clientY = 0
): Event {
  const evt = createTouch(type, clientX, clientY);
  window.dispatchEvent(evt);
  node.fire(type, { evt }, true);
  return evt;
}

/**
 * A touch event carrying one touch point. TouchEvent takes a Touch list no
 * headless runtime constructs the same way, so the list is defined on a plain
 * event instead, which is all the move stream reads.
 */
export function createTouch(type: string, clientX = 0, clientY = 0): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: [{ clientX, clientY }],
  });
  return event;
}

/** The window mousemove drag$ measures its next delta from. */
export function movePointer(clientX: number, clientY: number): MouseEvent {
  const event = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  return event;
}

/** The window touchmove half of movePointer. */
export function moveTouch(clientX: number, clientY: number): Event {
  const event = createTouch('touchmove', clientX, clientY);
  window.dispatchEvent(event);
  return event;
}

/** The global mouseup every drag$ subscription completes on. */
export function releasePointer(): void {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

/**
 * The frame konva's own batchDraw paints on. The commit gate only calls it, so
 * the hit graph a pointer is tested against lands one animation frame after
 * whenDrawn resolves, and a hit test before that frame answers nothing.
 */
export function whenPainted(): Promise<void> {
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * A pointer move the way a browser delivers one to a Stage: dispatched on the
 * content konva binds its own listeners to, at a point in that content's own
 * coordinates, so the enter and leave it dispatches are konva's own.
 */
export function moveScenePointer(stage: Stage, x: number, y: number): void {
  const origin = stage.content.getBoundingClientRect();

  stage.content.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: origin.left + x,
      clientY: origin.top + y,
    })
  );
}
