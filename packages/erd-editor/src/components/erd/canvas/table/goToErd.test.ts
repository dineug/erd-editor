// The store half of Go to ERD: the tab in one dispatch and the scroll with the
// selection in the next, since a batch is classified against the state before
// it; and a table the document no longer holds asks for neither.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  goToErdTable,
  showErdTableAction$,
} from '@/components/erd/canvas/table/goToErd';
import { CanvasType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

const VIEWPORT = { width: 800, height: 600 };

const apps: AppContext[] = [];

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

/** One table on screen and one far outside the viewport, on the Visualization tab. */
function seed(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 'near', ui: { x: 60, y: 60, zIndex: 1 } }),
    addTableAction({ id: 'far', ui: { x: 4000, y: 3000, zIndex: 2 } }),
    changeCanvasTypeAction({ value: CanvasType.visualization })
  );

  return app;
}

/** Every batch the store reduces from here on, by the types it carries. */
function recordBatches(app: AppContext): string[][] {
  const batches: string[][] = [];
  app.store.subscribe((actions: AnyAction[]) => {
    batches.push(actions.map(({ type }) => type));
  });

  return batches;
}

describe('showErdTableAction$', () => {
  it('asks for nothing at all for a table the document no longer holds', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTableAction$('gone'));

    expect(batches.flat()).toEqual([]);
    expect(app.store.state.settings.originX).toBe(0);
    expect(app.store.state.settings.originY).toBe(0);
  });
});

describe('goToErdTable', () => {
  it('changes the tab alone first, then scrolls and selects in a second batch', () => {
    const app = seed();
    const batches = recordBatches(app);

    goToErdTable(app.store, 'far');

    expect(batches[0]).toEqual(['settings.changeCanvasType']);
    expect(batches[1]).toContain('settings.scrollTo');
    expect(batches[1]).not.toContain('settings.changeCanvasType');
    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(Boolean(app.store.state.editor.selectedMap.far)).toBe(true);
  });

  it('leaves the scroll out of the second batch for a table already on screen', () => {
    const app = seed();
    const batches = recordBatches(app);

    goToErdTable(app.store, 'near');

    expect(batches[0]).toEqual(['settings.changeCanvasType']);
    expect(batches[1]).not.toContain('settings.scrollTo');
    expect(app.store.state.settings.originX).toBe(0);
    expect(Boolean(app.store.state.editor.selectedMap.near)).toBe(true);
  });
});
