import { createRef, FC, html, ref } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { useViewShortcut, VIEW_KEY_BINDINGS } from '@/hooks/useViewShortcut';
import {
  createKeyBindingMap,
  KeyBindingName,
  KeyBindingNameList,
} from '@/utils/keyboard-shortcut';

/** The view's root as it binds its keys: the binder first, then the view's own keys. */
const Probe: FC<{}> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);
  useViewShortcut(ctx);

  return () => html`<div class="root" ${ref(root)}></div>`;
};

/** The same two hooks the other way round, which must bind the same narrowed map. */
const ReversedProbe: FC<{}> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  useViewShortcut(ctx);
  useKeyBindingMap(ctx, root);

  return () => html`<div class="root" ${ref(root)}></div>`;
};

/** The modifier $mod resolves to, read off the platform the way hasAppleDevice reads it. */
const APPLE = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

type KeyInit = { key: string; code?: string; mod?: boolean };

let mounted: Mounted | null = null;
let app: AppContext;
let shortcuts: KeyBindingName[] = [];

const press = ({ key, code, mod }: KeyInit) => {
  const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
  const event = new KeyboardEvent('keydown', {
    key,
    code: code ?? key,
    ctrlKey: Boolean(mod) && !APPLE,
    metaKey: Boolean(mod) && APPLE,
    bubbles: true,
    cancelable: true,
  });
  $root.dispatchEvent(event);
  return event;
};

const zoomLevel = () => app.store.state.settings.zoomLevel;

beforeEach(async () => {
  shortcuts = [];
  app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
  app.shortcut$.subscribe(({ type }) => shortcuts.push(type));
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('useViewShortcut', () => {
  it('names the three zoom chords, the search and Escape', () => {
    expect([...VIEW_KEY_BINDINGS].sort()).toEqual(
      [
        KeyBindingName.zoomIn,
        KeyBindingName.zoomOut,
        KeyBindingName.zoomReset,
        KeyBindingName.search,
        KeyBindingName.stop,
      ].sort()
    );
  });

  it('narrows the app map to those chords, as the defaults bind them', () => {
    const defaults = createKeyBindingMap();
    const bound = KeyBindingNameList.filter(
      name => app.keyBindingMap[name].length
    );

    expect(bound.sort()).toEqual([...VIEW_KEY_BINDINGS].sort());
    for (const name of VIEW_KEY_BINDINGS) {
      expect(app.keyBindingMap[name]).toEqual(defaults[name]);
    }
  });

  it('leaves an editing chord to the page, unprevented and unheard', () => {
    const presses = [
      press({ key: 'Delete' }),
      press({ key: 'Backspace' }),
      press({ key: ' ', code: 'Space' }),
      press({ key: 'a', code: 'KeyA', mod: true }),
      press({ key: 'f', code: 'KeyF', mod: true }),
      press({ key: 'Enter' }),
      press({ key: 'z', code: 'KeyZ', mod: true }),
    ];

    expect(presses.map(event => event.defaultPrevented)).toEqual(
      presses.map(() => false)
    );
    expect(shortcuts).toEqual([]);
  });

  it('hears the search and Escape, which the palette answers', () => {
    const search = press({ key: 'k', code: 'KeyK', mod: true });
    const stop = press({ key: 'Escape' });

    expect(shortcuts).toEqual([KeyBindingName.search, KeyBindingName.stop]);
    expect(search.defaultPrevented).toBe(true);
    expect(stop.defaultPrevented).toBe(false);
  });

  it('steps the zoom in and out on the zoom chords, and resets it', async () => {
    const before = zoomLevel();

    press({ key: '=', code: 'Equal', mod: true });
    await flush();
    expect(zoomLevel()).toBeCloseTo(before + ZOOM_STEP, 5);

    press({ key: '-', code: 'Minus', mod: true });
    press({ key: '-', code: 'Minus', mod: true });
    await flush();
    expect(zoomLevel()).toBeCloseTo(before - ZOOM_STEP, 5);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    press({ key: '0', code: 'Digit0', mod: true });
    await flush();
    expect(zoomLevel()).toBe(ZOOM_RESET);
  });

  it('leaves a zoom chord to the palette while it is open', async () => {
    const before = zoomLevel();
    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));

    const event = press({ key: '=', code: 'Equal', mod: true });
    await flush();

    expect(shortcuts).toEqual([KeyBindingName.zoomIn]);
    expect(event.defaultPrevented).toBe(true);
    expect(zoomLevel()).toBe(before);
  });

  it('zooms on nothing once the view has gone', async () => {
    const before = zoomLevel();
    mounted!.unmount();
    mounted = null;

    app.shortcut$.next({
      type: KeyBindingName.zoomIn,
      event: new KeyboardEvent('keydown'),
    });
    await flush();

    expect(zoomLevel()).toBe(before);
  });

  it('binds the same narrowed map when it runs before the binder', async () => {
    mounted!.unmount();
    app.store.destroy();
    app = createTestAppContext();
    app.shortcut$.subscribe(({ type }) => shortcuts.push(type));
    mounted = await mountAndFlush(html`<${ReversedProbe} />`, app);

    const removal = press({ key: 'Delete' });
    press({ key: 'k', code: 'KeyK', mod: true });

    expect(removal.defaultPrevented).toBe(false);
    expect(shortcuts).toEqual([KeyBindingName.search]);
  });
});
