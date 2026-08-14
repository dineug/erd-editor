import { FC, html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import {
  AppContext,
  appContext,
  appDestroy,
  createAppContext,
  useAppContext,
} from '@/components/appContext';
import { Clock } from '@/engine/clock';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('createAppContext', () => {
  it('composes the engine context with the store, subjects and emitter', () => {
    const app = createAppContext({ toWidth: text => text.length * 7 });

    expect(app.toWidth('abcd')).toBe(28);
    expect(app.clock).toBeInstanceOf(Clock);
    expect(app.store).toBeTruthy();
    expect(app.actions).toBeTruthy();
    expect(app.emitter).toBeTruthy();
    expect(app.shortcut$).toBeTruthy();
    expect(app.keydown$).toBeTruthy();
    expect(Object.isFrozen(app)).toBe(true);

    appDestroy(app);
  });

  it('exposes an observable key binding map seeded with the defaults', () => {
    const app = createTestAppContext();

    expect(app.keyBindingMap[KeyBindingName.edit]).toEqual([
      { shortcut: 'Enter' },
    ]);
    expect(Object.keys(app.keyBindingMap)).toContain(KeyBindingName.undo);

    appDestroy(app);
  });

  it('applies dispatched actions to the store state', () => {
    const app = createTestAppContext();

    app.store.dispatchSync(changeViewportAction({ width: 300, height: 400 }));

    expect(app.store.state.editor.viewport).toEqual({
      width: 300,
      height: 400,
    });

    appDestroy(app);
  });

  it('connects the store to the redux devtools extension in dev mode', () => {
    const devTools = {
      init: vi.fn(),
      send: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const connect = vi.fn(() => devTools);
    vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', { connect });

    const app = createAppContext({ toWidth: () => 0 });

    expect(import.meta.env.DEV).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(devTools.init).toHaveBeenCalledWith(app.store.state);

    appDestroy(app);
    vi.unstubAllGlobals();
  });

  it('does not connect the redux devtools extension outside dev mode', () => {
    const connect = vi.fn(() => ({
      init: vi.fn(),
      send: vi.fn(),
      unsubscribe: vi.fn(),
    }));
    vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', { connect });
    vi.stubEnv('DEV', false);

    const app = createAppContext({ toWidth: () => 0 });

    expect(connect).not.toHaveBeenCalled();
    expect(app.store).toBeTruthy();

    appDestroy(app);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('ignores change actions when the readonly option is on', () => {
    const readonly = createTestAppContext({ getReadonly: () => true });
    const editable = createTestAppContext({ getReadonly: () => false });

    readonly.store.dispatchSync(
      addTableAction({ id: 'table-a', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    editable.store.dispatchSync(
      addTableAction({ id: 'table-b', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    expect(readonly.store.state.doc.tableIds).toHaveLength(0);
    expect(editable.store.state.doc.tableIds).toEqual(['table-b']);

    appDestroy(readonly);
    appDestroy(editable);
  });
});

describe('appContext / useAppContext', () => {
  it('resolves the value provided by the closest provider', async () => {
    let resolved: AppContext | null = null;

    const Probe: FC<{}> = (_, ctx) => {
      const app = useAppContext(ctx);
      return () => {
        resolved = app.value;
        return html`<span>probe</span>`;
      };
    };

    const app = createTestAppContext();
    mounted = await mountAndFlush(html`<${Probe} />`, app);

    expect(mounted.container.textContent).toContain('probe');
    expect(resolved).toBe(app);
  });

  it('falls back to the given context when no provider answers', async () => {
    const fallback = createTestAppContext();
    let resolved: AppContext | null = null;

    const Probe: FC<{}> = (_, ctx) => {
      const app = useAppContext(ctx, fallback);
      return () => {
        resolved = app.value;
        return html`<span>fallback</span>`;
      };
    };

    const container = document.createElement('div');
    document.body.append(container);
    render(container, html`<${Probe} />`);
    await flush();

    expect(container.textContent).toContain('fallback');
    expect(resolved).toBe(fallback);

    render(container, null);
    container.remove();
    appDestroy(fallback);
  });

  it('creates the shared context with an empty default value', () => {
    expect(appContext.value).toBeTruthy();
    expect(Object.keys(appContext.value)).toHaveLength(0);
  });
});

describe('appDestroy', () => {
  it('clears the store, completes the subjects and drops emitter listeners', () => {
    const app = createTestAppContext();
    const received: string[] = [];

    app.emitter.on({ schemaGC: () => received.push('schemaGC') });
    app.store.dispatchSync(
      addTableAction({ id: 'table-a', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    expect(app.store.state.doc.tableIds).toEqual(['table-a']);

    appDestroy(app);

    expect(app.store.state.doc.tableIds).toHaveLength(0);
    expect(app.keydown$.isStopped).toBe(true);
    expect(app.shortcut$.isStopped).toBe(true);

    const keydowns: KeyboardEvent[] = [];
    app.keydown$.subscribe(event => keydowns.push(event));
    app.keydown$.next(new KeyboardEvent('keydown'));
    expect(keydowns).toHaveLength(0);

    app.emitter.emit({ type: 'schemaGC', payload: undefined } as any);
    expect(received).toHaveLength(0);
  });
});
