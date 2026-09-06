import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createTablePlacementMenus,
  menus,
} from '@/components/erd/erd-context-menu/menus/tablePlacementMenus';
import { Open } from '@/constants/open';
import { TablePlacement } from '@/constants/tablePlacement';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  app.store.destroy();
});

function listen(): TablePlacement[] {
  const placements: TablePlacement[] = [];
  app.emitter.on({
    openAutomaticTablePlacement: ({ payload: { placement } }) => {
      placements.push(placement);
    },
  });

  return placements;
}

describe('tablePlacementMenus', () => {
  // Coverage rather than order: what the menu is ordered by is a reading of
  // the list, and the names below are what pin that.
  it('offers every placement the editor knows, once each', () => {
    expect([...menus.map(menu => menu.placement)].sort()).toEqual(
      [...Object.values(TablePlacement)].sort()
    );
  });

  it('names each placement for the author rather than for elk', () => {
    expect(
      createTablePlacementMenus(app, vi.fn()).map(menu => menu.name)
    ).toEqual(['Force', 'Flow', 'Tree - vertical', 'Tree - horizontal']);
  });

  it('gives every placement an icon of its own', () => {
    const icons = menus.map(menu => menu.iconName);

    expect(new Set(icons).size).toBe(icons.length);
  });

  it('asks for the placement that was clicked', () => {
    const placements = listen();

    createTablePlacementMenus(app, vi.fn())
      .find(menu => menu.name === 'Tree - vertical')
      ?.onClick();

    expect(placements).toEqual([TablePlacement.layeredVertical]);
  });

  it('closes the menu it was opened from', () => {
    const onClose = vi.fn();

    createTablePlacementMenus(app, onClose)[0].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the overlay to open itself, so one path decides how', async () => {
    createTablePlacementMenus(app, vi.fn())[0].onClick();
    await flush();

    expect(
      app.store.state.editor.openMap[Open.automaticTablePlacement]
    ).toBeUndefined();
  });
});
