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
};

let mounted: Mounted | null = null;
let app: AppContext;
let shortcuts: Array<{ type: KeyBindingName; event: KeyboardEvent }> = [];

const keydown = ({ key, code, altKey }: KeyInit) =>
  new KeyboardEvent('keydown', {
    key,
    code: code ?? key,
    altKey: altKey ?? false,
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

  it('stops listening after the component unmounts', () => {
    const $root = mounted!.container.querySelector('.root') as HTMLDivElement;
    mounted!.unmount();
    mounted = null;

    $root.dispatchEvent(keydown({ key: 'Enter' }));

    expect(shortcuts).toHaveLength(0);
  });
});
