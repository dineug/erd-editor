import { beforeEach, describe, expect, it } from 'vitest';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createShowMenus } from '@/components/erd/erd-context-menu/menus/showMenus';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { bHas } from '@/utils/bit';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
});

const NAME_TO_SHOW: Array<[string, number]> = [
  ['Table Comment', Show.tableComment],
  ['Column Comment', Show.columnComment],
  ['DataType', Show.columnDataType],
  ['Default', Show.columnDefault],
  ['Not Null', Show.columnNotNull],
  ['Unique', Show.columnUnique],
  ['Auto Increment', Show.columnAutoIncrement],
  ['Relationship', Show.relationship],
];

describe('showMenus', () => {
  it('exposes one menu per view option in declaration order', () => {
    expect(createShowMenus(app).map(menu => menu.name)).toEqual(
      NAME_TO_SHOW.map(([name]) => name)
    );
  });

  it('derives checked from the settings show bitmask', () => {
    const { show } = app.store.state.settings;

    for (const [name, bit] of NAME_TO_SHOW) {
      const menu = createShowMenus(app).find(item => item.name === name);
      expect(menu?.checked).toBe(bHas(show, bit));
    }
  });

  it('turns an enabled option off on click', async () => {
    app.store.dispatchSync(
      changeShowAction({ show: Show.tableComment, value: true })
    );
    expect(bHas(app.store.state.settings.show, Show.tableComment)).toBe(true);

    createShowMenus(app)
      .find(menu => menu.name === 'Table Comment')
      ?.onClick();
    await flush();

    expect(bHas(app.store.state.settings.show, Show.tableComment)).toBe(false);
  });

  it('turns a disabled option on on click', async () => {
    app.store.dispatchSync(
      changeShowAction({ show: Show.columnComment, value: false })
    );
    expect(bHas(app.store.state.settings.show, Show.columnComment)).toBe(false);

    createShowMenus(app)
      .find(menu => menu.name === 'Column Comment')
      ?.onClick();
    await flush();

    expect(bHas(app.store.state.settings.show, Show.columnComment)).toBe(true);
  });

  it('toggles every option independently', async () => {
    for (const [name, bit] of NAME_TO_SHOW) {
      const before = bHas(app.store.state.settings.show, bit);

      createShowMenus(app)
        .find(menu => menu.name === name)
        ?.onClick();
      await flush();

      expect(bHas(app.store.state.settings.show, bit)).toBe(!before);
    }
  });

  it('does not touch other bits when toggling one option', async () => {
    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: true })
    );

    createShowMenus(app)
      .find(menu => menu.name === 'Unique')
      ?.onClick();
    await flush();

    expect(bHas(app.store.state.settings.show, Show.relationship)).toBe(true);
  });
});
