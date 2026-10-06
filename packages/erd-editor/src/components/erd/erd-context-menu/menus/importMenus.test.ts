import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/i18n';
import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createImportMenus } from '@/components/erd/erd-context-menu/menus/importMenus';
import { menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';
import { setImportFileCallback } from '@/utils/file/importFile';

let app: AppContext;
let requests: Array<{
  type: string;
  op: string;
  accept: string;
  mode?: string;
}>;

beforeEach(() => {
  app = createTestAppContext();
  requests = [];
  setImportFileCallback(options => {
    requests.push({ ...options });
  });
});

afterEach(() => {
  setImportFileCallback(null);
});

describe('importMenus', () => {
  it('exposes every import format with its icon', () => {
    const result = createImportMenus(app, () => {});

    expect(result.map(menu => menu.name)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);
    expect(result.map(menu => menu.icon)).toEqual([
      'braces',
      'database',
      'code',
      'code',
      'code',
    ]);
  });

  it('translates Schema SQL alone, the format names reading the same in every language', () => {
    const result = createImportMenus(app, () => {});

    expect(result.map(menu => menu.labelKey)).toEqual([
      undefined,
      'common.tab.schemaSql',
      undefined,
      undefined,
      undefined,
    ]);
    expect(result.map(menu => menuLabel(sourceI18n, menu))).toEqual(
      result.map(menu => menu.name)
    );
    expect(
      result.map(menu =>
        menuLabel(createI18n('ko-KR', pseudoMessages('ko')), menu)
      )
    ).toEqual(['json', 'ko:Schema SQL', 'GraphQL', 'DBML', 'AML']);
  });

  it('requests a json import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[0].onClick();

    expect(requests).toEqual([{ type: 'json', op: 'set', accept: '.json' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requests a sql import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[1].onClick();

    expect(requests).toEqual([{ type: 'sql', op: 'set', accept: '.sql' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requests a graphql import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[2].onClick();

    expect(requests).toEqual([
      { type: 'graphql', op: 'set', accept: '.graphql,.gql,.graphqls' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requests a dbml import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[3].onClick();

    expect(requests).toEqual([{ type: 'dbml', op: 'set', accept: '.dbml' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requests an aml import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[4].onClick();

    expect(requests).toEqual([{ type: 'aml', op: 'set', accept: '.aml' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for each format to add for Import and Add, naming the mode', () => {
    const onClose = vi.fn();
    const menus = createImportMenus(app, onClose, 'append');

    expect(menus.map(menu => menu.name)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);
    menus.forEach(menu => menu.onClick());

    expect(requests).toEqual([
      { type: 'json', op: 'set', accept: '.json', mode: 'append' },
      { type: 'sql', op: 'set', accept: '.sql', mode: 'append' },
      {
        type: 'graphql',
        op: 'set',
        accept: '.graphql,.gql,.graphqls',
        mode: 'append',
      },
      { type: 'dbml', op: 'set', accept: '.dbml', mode: 'append' },
      { type: 'aml', op: 'set', accept: '.aml', mode: 'append' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(5);
  });

  it('falls back to a file input when no import callback is registered', () => {
    setImportFileCallback(null);
    const onClose = vi.fn();
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});

    createImportMenus(app, onClose)[0].onClick();

    expect(click).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
