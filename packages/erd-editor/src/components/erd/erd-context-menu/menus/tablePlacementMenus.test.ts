import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/i18n';
import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createTablePlacementMenus,
  menus,
} from '@/components/erd/erd-context-menu/menus/tablePlacementMenus';
import { Open } from '@/constants/open';
import { TablePlacement } from '@/constants/tablePlacement';
import { menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

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
  // the list, and the names below are what pin that. The views' own preset is
  // not on it, because nothing asks the author to pick it.
  it('offers every placement the author can pick, once each', () => {
    expect([...menus.map(menu => menu.placement)].sort()).toEqual(
      Object.values(TablePlacement)
        .filter(placement => placement !== TablePlacement.viewLayered)
        .sort()
    );
  });

  it('names each placement for the author rather than for elk', () => {
    expect(
      createTablePlacementMenus(app, vi.fn()).map(menu => menu.name)
    ).toEqual(['Force', 'Flow', 'Tree - vertical', 'Tree - horizontal']);
  });

  it('names each placement through its key, which reads as its name in English', () => {
    const created = createTablePlacementMenus(app, vi.fn());

    expect(created.map(menu => menu.labelKey)).toEqual([
      'common.placement.force',
      'common.placement.flow',
      'common.placement.treeVertical',
      'common.placement.treeHorizontal',
    ]);
    expect(created.map(menu => menuLabel(sourceI18n, menu))).toEqual(
      created.map(menu => menu.name)
    );
    expect(
      created.map(menu =>
        menuLabel(createI18n('ko-KR', pseudoMessages('ko')), menu)
      )
    ).toEqual([
      'ko:Force',
      'ko:Flow',
      'ko:Tree - vertical',
      'ko:Tree - horizontal',
    ]);
  });

  it('draws the two tree placements as one icon and the rest apart', () => {
    const iconOf = (name: string) =>
      menus.find(menu => menu.name === name)?.iconName;

    expect(iconOf('Tree - vertical')).toBe(iconOf('Tree - horizontal'));
    expect(new Set(menus.map(menu => menu.iconName)).size).toBe(
      menus.length - 1
    );
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
