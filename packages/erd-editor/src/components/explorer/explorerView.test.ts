import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';

import {
  explorerScrollOf,
  explorerViewOf,
  TABLES_FOLDER_ID,
} from './explorerView';

const apps: AppContext[] = [];
const app = () => {
  const created = createTestAppContext();
  apps.push(created);
  return created;
};

afterEach(() => {
  apps.splice(0).forEach(created => created.store.destroy());
});

describe('explorerViewOf', () => {
  it('starts closed at 260 px with the Tables folder alone open (AC-T8)', () => {
    expect(explorerViewOf(app().store)).toMatchObject({
      open: false,
      zenReveal: false,
      width: 260,
      expanded: { [TABLES_FOLDER_ID]: true },
      activeId: null,
    });
  });

  it('keeps one state per editor for as long as it lives, and starts each new one afresh (AC-S8)', () => {
    const first = app();
    const view = explorerViewOf(first.store);
    view.open = true;
    view.width = 300;

    expect(explorerViewOf(first.store)).toBe(view);
    expect(explorerViewOf(app().store)).toMatchObject({
      open: false,
      width: 260,
    });
  });

  it('keeps the scroll position in a place of its own per editor', () => {
    const first = app();
    explorerScrollOf(first.store).top = 120;

    expect(explorerScrollOf(first.store).top).toBe(120);
    expect(explorerScrollOf(app().store).top).toBe(0);
  });
});
