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
import { createExportMenus } from '@/components/erd/erd-context-menu/menus/exportMenus';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { setExportFileCallback } from '@/utils/file/exportFile';

let app: AppContext;
let exported: Array<{ type: string; fileName: string }>;

beforeEach(() => {
  app = createTestAppContext();
  exported = [];
  setExportFileCallback((blob, options) => {
    exported.push({ type: blob.type, fileName: options.fileName });
  });
});

afterEach(() => {
  setExportFileCallback(null);
});

describe('exportMenus', () => {
  it('exposes json, Schema SQL and Image… entries with their icons', () => {
    const result = createExportMenus(app, () => {});

    expect(result.map(menu => menu.name)).toEqual([
      'json',
      'Schema SQL',
      'Image…',
    ]);
    expect(result.map(menu => menu.icon)).toEqual([
      'braces',
      'database',
      'file-image',
    ]);
  });

  it('exports the document as json named after the database', () => {
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    const onClose = vi.fn();

    createExportMenus(app, onClose)[0].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('application/json');
    expect(exported[0].fileName).toMatch(/^shop-.*\.erd\.json$/);
  });

  it('falls back to an unnamed file when the database name is blank', () => {
    createExportMenus(app, () => {})[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-.*\.erd\.json$/);
  });

  it('exports the schema sql', async () => {
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await flush();
    const onClose = vi.fn();

    createExportMenus(app, onClose)[1].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].fileName).toMatch(/^shop-.*\.sql$/);
  });

  it('closes the menu and opens the export image dialog instead of writing a file', () => {
    const order: string[] = [];
    const off = app.emitter.on({
      openExportImage: () => order.push('open dialog'),
    });

    createExportMenus(app, () => order.push('close menu'))[2].onClick();

    expect(order).toEqual(['close menu', 'open dialog']);
    expect(exported).toEqual([]);
    off();
  });

  it('captures the database name at creation time', () => {
    const menus = createExportMenus(app, () => {});
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'later' }));

    menus[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-/);
  });
});
