import { createRef, FC, html, ref } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { TAKEOVERS } from '@/components/find-replace/panelLayout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const Probe: FC<{}> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  return () => html`<div class="root" ${ref(root)}></div>`;
};

type KeyInit = {
  key: string;
  code?: string;
  altKey?: boolean;
  mod?: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

/** The modifier $mod resolves to, read off the platform the way tinykeys reads it. */
const APPLE = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

let mounted: Mounted | null = null;
let app: AppContext;
let shortcuts: Array<{ type: KeyBindingName; event: KeyboardEvent }> = [];

const keydown = ({ key, code, altKey, mod, isComposing, keyCode }: KeyInit) =>
  new KeyboardEvent('keydown', {
    key,
    code: code ?? key,
    altKey: altKey ?? false,
    ctrlKey: Boolean(mod) && !APPLE,
    metaKey: Boolean(mod) && APPLE,
    isComposing: isComposing ?? false,
    keyCode: keyCode ?? 0,
    bubbles: true,
    cancelable: true,
  });

const press = (init: KeyInit) => {
  const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
  const event = keydown(init);
  $root.dispatchEvent(event);
  return event;
};

beforeEach(async () => {
  shortcuts = [];
  app = createTestAppContext();
  app.shortcut$.subscribe(value => shortcuts.push(value));
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('useKeyBindingMap', () => {
  it('emits the matching key binding name on shortcut$', () => {
    press({ key: 'Enter' });

    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].type).toBe(KeyBindingName.edit);
    expect(shortcuts[0].event).toBeInstanceOf(KeyboardEvent);
  });

  it('maps every default binding it was given', () => {
    press({ key: 'Escape' });
    press({ key: 'n', code: 'KeyN', altKey: true });

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.stop,
      KeyBindingName.addTable,
    ]);
  });

  it('supports several shortcuts bound to the same name', () => {
    press({ key: 'Backspace', altKey: true });
    press({ key: 'Delete', altKey: true });

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.removeColumn,
      KeyBindingName.removeColumn,
    ]);
  });

  it('calls preventDefault only for options that ask for it', () => {
    const withPreventDefault = press({ key: 'n', code: 'KeyN', altKey: true });
    const withoutPreventDefault = press({ key: 'Enter' });

    expect(withPreventDefault.defaultPrevented).toBe(true);
    expect(withoutPreventDefault.defaultPrevented).toBe(false);
  });

  it('lets non stopPropagation shortcuts keep bubbling', () => {
    const onKeydown = vi.fn();
    mounted!.container.addEventListener('keydown', onKeydown);

    press({ key: 'Enter' });

    expect(onKeydown).toHaveBeenCalledTimes(1);
    expect(shortcuts).toHaveLength(1);
  });

  it('reads $mod+KeyA as the select all command', () => {
    const event = press({ key: 'a', code: 'KeyA', mod: true });

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.selectAllTable,
    ]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('reads a bare Space as the hand tool on the canvas', () => {
    const event = press({ key: ' ', code: 'Space' });

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.handTool,
    ]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Space to a caret, which owns it as a space', () => {
    const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
    const input = document.createElement('input');
    $root.append(input);

    const event = keydown({ key: ' ', code: 'Space' });
    input.dispatchEvent(event);

    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves $mod+KeyA to a caret, which owns it as select all text', () => {
    const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
    const input = document.createElement('input');
    $root.append(input);

    const event = keydown({ key: 'a', code: 'KeyA', mod: true });
    input.dispatchEvent(event);

    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('takes $mod+KeyF on the ERD tab from a caret too, so no browser find opens over the editor', () => {
    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
    const input = document.createElement('input');
    $root.append(input);
    const outside = vi.fn();
    mounted!.container.addEventListener('keydown', outside);

    const onCanvas = press({ key: 'f', code: 'KeyF', mod: true });
    const inField = keydown({ key: 'f', code: 'KeyF', mod: true });
    input.dispatchEvent(inField);

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.findReplace,
      KeyBindingName.findReplace,
    ]);
    expect(onCanvas.defaultPrevented).toBe(true);
    expect(inField.defaultPrevented).toBe(true);
    expect(outside).not.toHaveBeenCalled();
  });

  it.each([
    CanvasType.visualization,
    CanvasType.schemaSQL,
    CanvasType.generatorCode,
    CanvasType.settings,
  ])(
    'takes $mod+KeyF on the %s tab too, from the canvas or a caret',
    canvasType => {
      app.store.dispatchSync(changeCanvasTypeAction({ value: canvasType }));
      const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
      const input = document.createElement('input');
      $root.append(input);
      const outside = vi.fn();
      mounted!.container.addEventListener('keydown', outside);

      const onCanvas = press({ key: 'f', code: 'KeyF', mod: true });
      const inField = keydown({ key: 'f', code: 'KeyF', mod: true });
      input.dispatchEvent(inField);

      expect(shortcuts.map(({ type }) => type)).toEqual([
        KeyBindingName.findReplace,
        KeyBindingName.findReplace,
      ]);
      expect(onCanvas.defaultPrevented).toBe(true);
      expect(inField.defaultPrevented).toBe(true);
      expect(outside).not.toHaveBeenCalled();
    }
  );

  it.each(TAKEOVERS)(
    'leaves $mod+KeyF to the host find on the ERD tab while %s takes the canvas over',
    key => {
      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
      const input = document.createElement('input');
      $root.append(input);
      const outside = vi.fn();
      mounted!.container.addEventListener('keydown', outside);

      const onCanvas = press({ key: 'f', code: 'KeyF', mod: true });
      const inField = keydown({ key: 'f', code: 'KeyF', mod: true });
      input.dispatchEvent(inField);

      expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
      expect(shortcuts).toHaveLength(0);
      expect(onCanvas.defaultPrevented).toBe(false);
      expect(inField.defaultPrevented).toBe(false);
      expect(outside).toHaveBeenCalledTimes(2);
      // The other chords stay the editor's under it.
      expect(
        press({ key: 'k', code: 'KeyK', mod: true }).defaultPrevented
      ).toBe(true);

      // Taken again once the overlay has gone.
      shortcuts = [];
      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
      expect(
        press({ key: 'f', code: 'KeyF', mod: true }).defaultPrevented
      ).toBe(true);
      expect(shortcuts.map(({ type }) => type)).toEqual([
        KeyBindingName.findReplace,
      ]);
    }
  );

  it('leaves $mod+KeyF to the host find on another tab while a takeover stays open', () => {
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );

    const event = press({ key: 'f', code: 'KeyF', mod: true });

    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('takes $mod+KeyF under a dialog that only stands the panel aside', () => {
    for (const key of [Open.tableProperties, Open.themeBuilder]) {
      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      expect(
        press({ key: 'f', code: 'KeyF', mod: true }).defaultPrevented
      ).toBe(true);
      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
    }

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.findReplace,
      KeyBindingName.findReplace,
    ]);
  });

  it('reads Alt+KeyF as the Flow focus, never as find and replace', () => {
    press({ key: 'ƒ', code: 'KeyF', altKey: true });

    expect(shortcuts.map(({ type }) => type)).toEqual([
      KeyBindingName.focusView,
    ]);
  });

  it('ignores keys that are not part of the map', () => {
    press({ key: 'a', code: 'KeyA' });

    expect(shortcuts).toHaveLength(0);
  });

  it('rebinds when the key binding map changes', async () => {
    app.keyBindingMap.edit = [
      { shortcut: 'KeyQ', preventDefault: true, stopPropagation: true },
    ];
    await flush();

    press({ key: 'Enter' });
    expect(shortcuts).toHaveLength(0);

    const event = press({ key: 'q', code: 'KeyQ' });
    expect(shortcuts.map(({ type }) => type)).toEqual([KeyBindingName.edit]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves $mod+KeyF to the page on the ERD tab too once a host empties findReplace', async () => {
    app.keyBindingMap.findReplace = [];
    await flush();
    const outside = vi.fn();
    mounted!.container.addEventListener('keydown', outside);

    const event = press({ key: 'f', code: 'KeyF', mod: true });

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('stops propagation for options that ask for it', async () => {
    app.keyBindingMap.edit = [
      { shortcut: 'KeyQ', preventDefault: true, stopPropagation: true },
    ];
    await flush();

    const onKeydown = vi.fn();
    mounted!.container.addEventListener('keydown', onKeydown);

    press({ key: 'q', code: 'KeyQ' });

    expect(shortcuts).toHaveLength(1);
    expect(onKeydown).not.toHaveBeenCalled();
  });

  it('unbinds the previous shortcuts when rebinding, keeping one emit per press', async () => {
    app.keyBindingMap.stop = [{ shortcut: 'Escape' }];
    await flush();

    press({ key: 'Escape' });

    expect(shortcuts).toHaveLength(1);
  });

  // Every binding goes through one handler, so the composition guard is checked
  // once for the whole map rather than per chord.
  it.each([
    ['isComposing', { isComposing: true }],
    ['keyCode 229', { keyCode: 229 }],
  ])('emits nothing while the IME reports %s', (_label, composing) => {
    const event = press({ key: 'Enter', ...composing });

    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('emits nothing for a preventDefault binding pressed mid-composition', () => {
    const event = press({
      key: 'n',
      code: 'KeyN',
      altKey: true,
      isComposing: true,
    });

    expect(shortcuts).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('emits the same chord again once the composition has ended', () => {
    press({ key: 'Escape', isComposing: true });
    expect(shortcuts).toHaveLength(0);

    press({ key: 'Escape' });
    expect(shortcuts.map(({ type }) => type)).toEqual([KeyBindingName.stop]);
  });

  it('stops listening after the component unmounts', () => {
    const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
    mounted!.unmount();
    mounted = null;

    $root.dispatchEvent(keydown({ key: 'Enter' }));

    expect(shortcuts).toHaveLength(0);
  });
});
