import { watch } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  resolvePanel,
  schemaSQLViewOf,
  showSchemaSQLExport,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { CanvasType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';

const apps: AppContext[] = [];

function createApp(width = 1280): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width, height: 800 }));
  apps.push(app);
  return app;
}

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

describe('schemaSQLViewOf', () => {
  it('starts on if not exists, create and use, an unset panel and no focus asked', () => {
    expect({ ...schemaSQLViewOf(createApp()) }).toEqual({
      statements: 'ifNotExists',
      header: 'createAndUse',
      panel: 'unset',
      focusSave: false,
    });
  });

  it('keeps one view per editor, never shared with another', () => {
    const app = createApp();
    const other = createApp();

    expect(schemaSQLViewOf(app)).toBe(schemaSQLViewOf(app));
    expect(schemaSQLViewOf({ store: app.store })).toBe(schemaSQLViewOf(app));
    expect(schemaSQLViewOf(other)).not.toBe(schemaSQLViewOf(app));

    schemaSQLViewOf(app).statements = 'recreate';
    expect(schemaSQLViewOf(other).statements).toBe('ifNotExists');
  });

  it('tells a watcher which choice changed, and dispatches nothing', async () => {
    const app = createApp();
    const view = schemaSQLViewOf(app);
    const changed: Array<string | number | symbol> = [];
    const dispatched = vi.fn();
    const stopWatching = watch(view).subscribe(name => changed.push(name));
    const unsubscribe = app.store.subscribe(dispatched);

    view.header = 'use';
    await flush();

    expect(changed).toEqual(['header']);
    expect(dispatched).not.toHaveBeenCalled();
    stopWatching();
    unsubscribe();
  });
});

describe('resolvePanel', () => {
  it('knows nothing of an editor not measured yet, and leaves the panel unset', () => {
    const view = schemaSQLViewOf(createApp());

    expect(resolvePanel(view, 0)).toBe('unknown');
    expect(view.panel).toBe('unset');
  });

  it('folds the panel under 640 px and opens it from 640 px, keeping the first answer', () => {
    const narrow = schemaSQLViewOf(createApp());
    const wide = schemaSQLViewOf(createApp());

    expect(resolvePanel(narrow, 639)).toBe('closed');
    expect(narrow.panel).toBe('closed');
    expect(resolvePanel(narrow, 1280)).toBe('closed');

    expect(resolvePanel(wide, 640)).toBe('open');
    expect(wide.panel).toBe('open');
    expect(resolvePanel(wide, 300)).toBe('open');
  });
});

describe('toggleSchemaSQLPanel', () => {
  it('folds an open panel and opens a folded one', () => {
    const app = createApp();
    const view = schemaSQLViewOf(app);

    toggleSchemaSQLPanel(app);
    expect(view.panel).toBe('closed');

    toggleSchemaSQLPanel(app);
    expect(view.panel).toBe('open');
  });

  it('turns an unset panel the other way from where the width would put it', () => {
    const narrow = createApp(600);
    toggleSchemaSQLPanel(narrow);
    expect(schemaSQLViewOf(narrow).panel).toBe('open');

    const unmeasured = createApp(0);
    toggleSchemaSQLPanel(unmeasured);
    expect(schemaSQLViewOf(unmeasured).panel).toBe('open');
  });
});

describe('showSchemaSQLExport', () => {
  it('opens the Schema SQL tab with its panel out and Save file asked for', async () => {
    const app = createApp(600);
    const view = schemaSQLViewOf(app);
    view.panel = 'closed';

    showSchemaSQLExport(app);
    await flush();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    expect(view.panel).toBe('open');
    expect(view.focusSave).toBe(true);
  });

  it('dispatches no tab change on the tab already shown', async () => {
    const app = createApp();
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    const dispatched = vi.fn();
    const unsubscribe = app.store.subscribe(dispatched);

    showSchemaSQLExport(app);
    await flush();

    expect(dispatched).not.toHaveBeenCalled();
    expect(schemaSQLViewOf(app).focusSave).toBe(true);
    unsubscribe();
  });
});
