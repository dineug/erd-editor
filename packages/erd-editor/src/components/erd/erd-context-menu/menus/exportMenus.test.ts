import { toBlob } from 'html-to-image';
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

vi.mock('html-to-image', () => ({
  toBlob: vi.fn(async () => new Blob(['png-bytes'], { type: 'image/png' })),
}));

let app: AppContext;
let root: HTMLElement;
let exported: Array<{ text: string; type: string; fileName: string }>;

beforeEach(() => {
  app = createTestAppContext();
  root = document.createElement('div');
  exported = [];
  setExportFileCallback((blob, options) => {
    exported.push({
      text: '',
      type: blob.type,
      fileName: options.fileName,
    });
  });
  vi.mocked(toBlob).mockClear();
});

afterEach(() => {
  setExportFileCallback(null);
});

describe('exportMenus', () => {
  it('exposes json, Schema SQL and png entries with their icons', () => {
    const result = createExportMenus(app, () => {}, root);

    expect(result.map(menu => menu.name)).toEqual([
      'json',
      'Schema SQL',
      'png',
    ]);
    expect(result.map(menu => menu.icon)).toEqual([
      { prefix: 'mdi', name: 'code-json' },
      { prefix: 'mdi', name: 'database-export' },
      { prefix: 'fas', name: 'file-image' },
    ]);
  });

  it('exports the document as json named after the database', () => {
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    const onClose = vi.fn();

    createExportMenus(app, onClose, root)[0].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('application/json');
    expect(exported[0].fileName).toMatch(/^shop-.*\.erd\.json$/);
  });

  it('falls back to an unnamed file when the database name is blank', () => {
    createExportMenus(app, () => {}, root)[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-.*\.erd\.json$/);
  });

  it('exports the schema sql', async () => {
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await flush();
    const onClose = vi.fn();

    createExportMenus(app, onClose, root)[1].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].fileName).toMatch(/^shop-.*\.sql$/);
  });

  it('renders the canvas root to a png', async () => {
    const onClose = vi.fn();

    createExportMenus(app, onClose, root)[2].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(root);

    await flush();

    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('image/png');
    expect(exported[0].fileName).toMatch(/\.png$/);
  });

  it('skips the export when png rendering yields no blob', async () => {
    vi.mocked(toBlob).mockResolvedValueOnce(null as unknown as Blob);

    createExportMenus(app, () => {}, root)[2].onClick();
    await flush();

    expect(exported).toHaveLength(0);
  });

  it('captures the database name at creation time', () => {
    const menus = createExportMenus(app, () => {}, root);
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'later' }));

    menus[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-/);
  });
});
