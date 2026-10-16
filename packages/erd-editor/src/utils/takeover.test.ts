import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';

import { isTakenOver, TAKEOVERS } from './takeover';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  app.store.destroy();
});

describe('isTakenOver', () => {
  it('names the three overlays that stand a scene of their own over the canvas', () => {
    expect(new Set(TAKEOVERS)).toEqual(
      new Set([Open.automaticTablePlacement, Open.diffViewer, Open.timeTravel])
    );
  });

  it('reads true while any of them is open and false once none is', () => {
    expect(isTakenOver(app.store.state)).toBe(false);

    for (const key of TAKEOVERS) {
      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      expect(isTakenOver(app.store.state)).toBe(true);
      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
      expect(isTakenOver(app.store.state)).toBe(false);
    }
  });

  it('ignores a dialog that leaves the canvas showing', () => {
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );

    expect(isTakenOver(app.store.state)).toBe(false);
  });
});
