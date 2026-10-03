import { beforeEach, describe, expect, it } from 'vite-plus/test';

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
  ['Alternate Key', Show.columnAlternateKey],
  ['Auto Increment', Show.columnAutoIncrement],
  ['Relationship', Show.relationship],
];

const ALL_MENUS = [
  ...NAME_TO_SHOW.map(([name]) => name),
  'Referential Actions',
];
const referentialActions = () =>
  createShowMenus(app).find(menu => menu.name === 'Referential Actions');

describe('showMenus', () => {
  it('exposes one menu per view option in declaration order', () => {
    expect(createShowMenus(app).map(menu => menu.name)).toEqual(ALL_MENUS);
  });

  it('checks Referential Actions while its hide bit is off, which a new document leaves it', () => {
    expect(
      bHas(app.store.state.settings.show, Show.hideReferentialAction)
    ).toBe(false);
    expect(referentialActions()?.checked).toBe(true);
  });

  it('sets the hide bit as Referential Actions is turned off, and clears it as it is turned on', async () => {
    referentialActions()?.onClick();
    await flush();

    expect(
      bHas(app.store.state.settings.show, Show.hideReferentialAction)
    ).toBe(true);
    expect(referentialActions()?.checked).toBe(false);

    referentialActions()?.onClick();
    await flush();

    expect(
      bHas(app.store.state.settings.show, Show.hideReferentialAction)
    ).toBe(false);
    expect(referentialActions()?.checked).toBe(true);
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
