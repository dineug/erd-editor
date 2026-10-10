import { watch } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  generatorCodeViewOf,
  toggleGeneratorCodePanel,
} from '@/components/generator-code/generatorCodeView';
import {
  schemaSQLViewOf,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';

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

describe('generatorCodeViewOf', () => {
  it('starts on an unset panel, one view per editor', () => {
    const app = createApp();
    const other = createApp();

    expect(generatorCodeViewOf(app)).toEqual({ panel: 'unset' });
    expect(generatorCodeViewOf(app)).toBe(generatorCodeViewOf(app));
    expect(generatorCodeViewOf(other)).not.toBe(generatorCodeViewOf(app));
  });

  it('keeps its own fold, apart from the Schema SQL tab', () => {
    const app = createApp();

    toggleSchemaSQLPanel(app);
    expect(schemaSQLViewOf(app).panel).toBe('closed');
    expect(generatorCodeViewOf(app).panel).toBe('unset');

    toggleGeneratorCodePanel(app);
    toggleGeneratorCodePanel(app);
    expect(generatorCodeViewOf(app).panel).toBe('open');
    expect(schemaSQLViewOf(app).panel).toBe('closed');
  });

  it('tells a watcher the panel moved, and dispatches nothing', async () => {
    const app = createApp();
    const changed: Array<string | number | symbol> = [];
    const dispatched = vi.fn();
    const stopWatching = watch(generatorCodeViewOf(app)).subscribe(propName =>
      changed.push(propName)
    );
    const unsubscribe = app.store.subscribe(dispatched);

    toggleGeneratorCodePanel(app);
    await flush();

    expect(changed).toContain('panel');
    expect(dispatched).not.toHaveBeenCalled();
    stopWatching();
    unsubscribe();
  });
});

describe('toggleGeneratorCodePanel', () => {
  it('folds an open panel and opens a folded one', () => {
    const app = createApp();
    const view = generatorCodeViewOf(app);

    toggleGeneratorCodePanel(app);
    expect(view.panel).toBe('closed');

    toggleGeneratorCodePanel(app);
    expect(view.panel).toBe('open');
  });

  it('turns an unset panel the other way from where the width would put it', () => {
    const narrow = createApp(600);
    toggleGeneratorCodePanel(narrow);
    expect(generatorCodeViewOf(narrow).panel).toBe('open');

    const unmeasured = createApp(0);
    toggleGeneratorCodePanel(unmeasured);
    expect(generatorCodeViewOf(unmeasured).panel).toBe('open');
  });
});
