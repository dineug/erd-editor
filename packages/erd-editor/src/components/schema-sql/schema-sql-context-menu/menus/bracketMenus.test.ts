import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext, appDestroy } from '@/components/appContext';
import {
  createBracketMenus,
  menus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { BracketType } from '@/constants/schema';
import { changeBracketTypeAction } from '@/engine/modules/settings/atom.actions';

let app: AppContext | null = null;

const createApp = () => {
  app = createTestAppContext();
  return app;
};

afterEach(() => {
  app && appDestroy(app);
  app = null;
});

describe('bracketMenus', () => {
  it('exposes the four bracket options in a stable order', () => {
    expect(menus.map(menu => menu.name)).toEqual([
      'SingleQuote',
      'DoubleQuote',
      'Backtick',
      'None',
    ]);
  });

  it('maps every option onto its BracketType constant', () => {
    expect(menus.map(menu => menu.value)).toEqual([
      BracketType.singleQuote,
      BracketType.doubleQuote,
      BracketType.backtick,
      BracketType.none,
    ]);
  });

  it('creates one menu per option carrying a name and a click handler', () => {
    const created = createBracketMenus(createApp());

    expect(created).toHaveLength(menus.length);
    created.forEach((menu, i) => {
      expect(menu.name).toBe(menus[i].name);
      expect(typeof menu.onClick).toBe('function');
    });
  });

  it('checks only the option matching the current settings.bracketType', () => {
    const created = createBracketMenus(createApp());

    expect(created.map(menu => menu.checked)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it('re-evaluates checked against the settings at creation time', async () => {
    const context = createApp();
    context.store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.backtick })
    );
    await flush();

    const created = createBracketMenus(context);

    expect(created.map(menu => menu.checked)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('dispatches changeBracketType with the clicked option value', async () => {
    const context = createApp();
    const created = createBracketMenus(context);

    created[0].onClick();
    await flush();

    expect(context.store.state.settings.bracketType).toBe(
      BracketType.singleQuote
    );
  });

  it('lets every option drive the settings state through its handler', async () => {
    const context = createApp();

    for (const menu of createBracketMenus(context)) {
      menu.onClick();
      await flush();

      const expected = menus.find(item => item.name === menu.name)?.value;
      expect(context.store.state.settings.bracketType).toBe(expected);
    }
  });

  it('records the dispatch on the store so it can be observed', async () => {
    const context = createApp();
    const types: string[] = [];
    const unsubscribe = context.store.subscribe(actions => {
      actions.forEach(action => types.push(action.type));
    });

    createBracketMenus(context)[2].onClick();
    await flush();
    unsubscribe();

    expect(types).toContain('settings.changeBracketType');
    expect(context.store.state.settings.bracketType).toBe(BracketType.backtick);
  });
});
