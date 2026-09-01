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
import { createDocumentPng } from '@/services/export-png';
import type { Theme } from '@/themes/tokens';
import { setExportFileCallback } from '@/utils/file/exportFile';

vi.mock('@/services/export-png', () => ({
  createDocumentPng: vi.fn(
    async () => new Blob(['png-bytes'], { type: 'image/png' })
  ),
}));

const theme = { canvasBackground: '#101112' } as Theme;

let app: AppContext;
let exported: Array<{ text: string; type: string; fileName: string }>;

beforeEach(() => {
  app = createTestAppContext();
  exported = [];
  setExportFileCallback((blob, options) => {
    exported.push({
      text: '',
      type: blob.type,
      fileName: options.fileName,
    });
  });
  vi.mocked(createDocumentPng).mockClear();
});

afterEach(() => {
  setExportFileCallback(null);
});

describe('exportMenus', () => {
  it('exposes json, Schema SQL and png entries with their icons', () => {
    const result = createExportMenus(app, () => {}, theme);

    expect(result.map(menu => menu.name)).toEqual([
      'json',
      'Schema SQL',
      'png',
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

    createExportMenus(app, onClose, theme)[0].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('application/json');
    expect(exported[0].fileName).toMatch(/^shop-.*\.erd\.json$/);
  });

  it('falls back to an unnamed file when the database name is blank', () => {
    createExportMenus(app, () => {}, theme)[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-.*\.erd\.json$/);
  });

  it('exports the schema sql', async () => {
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await flush();
    const onClose = vi.fn();

    createExportMenus(app, onClose, theme)[1].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(exported).toHaveLength(1);
    expect(exported[0].fileName).toMatch(/^shop-.*\.sql$/);
  });

  it('renders the whole document to a png, not anything on screen', async () => {
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await flush();
    const onClose = vi.fn();

    createExportMenus(app, onClose, theme)[2].onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    const [request] = vi.mocked(createDocumentPng).mock.calls[0];
    expect(JSON.parse(request.doc).doc.tableIds).toEqual(['table-1']);
    expect(request.theme).toBe(theme);
    expect(request.toWidth).toBe(app.toWidth);

    await flush();

    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('image/png');
    expect(exported[0].fileName).toMatch(/\.png$/);
  });

  it('reports rather than swallows a render failure, and writes no file', async () => {
    vi.mocked(createDocumentPng).mockRejectedValueOnce(new Error('no canvas'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    createExportMenus(app, () => {}, theme)[2].onClick();
    await flush();

    expect(exported).toHaveLength(0);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('tells the user with a toast when the render fails', async () => {
    vi.mocked(createDocumentPng).mockRejectedValueOnce(new Error('no canvas'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const toasts: unknown[] = [];
    const off = app.emitter.on({ openToast: action => toasts.push(action) });

    createExportMenus(app, () => {}, theme)[2].onClick();
    await flush();

    expect(toasts).toHaveLength(1);
    off();
    error.mockRestore();
  });

  it('captures the database name at creation time', () => {
    const menus = createExportMenus(app, () => {}, theme);
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'later' }));

    menus[0].onClick();

    expect(exported[0].fileName).toMatch(/^unnamed-/);
  });
});
