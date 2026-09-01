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
  vi.useRealTimers();
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const png = () => new Blob(['png-bytes'], { type: 'image/png' });

/** The strings a toast was built from, which is all its template exposes. */
const labelOf = (payload: any) =>
  (payload.message.values as unknown[])
    .filter(value => typeof value === 'string')
    .join(' | ');

/**
 * Every open and close of a toast in the order it happened, which is the one
 * way to tell a sequence of messages from a pile of them.
 */
function recordToasts(app: AppContext, log: string[]) {
  return app.emitter.on({
    openToast: ({ payload }) => {
      const label = labelOf(payload);
      log.push(`open ${label}`);
      payload.close?.then(() => log.push(`close ${label}`));
    },
  });
}

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

  it('tells the user what it gave up when the image is scaled down', async () => {
    vi.mocked(createDocumentPng).mockImplementationOnce(async options => {
      options.onResolutionReduced?.({
        documentWidth: 20_000,
        documentHeight: 20_000,
        width: 16_384,
        height: 16_384,
      });
      return new Blob(['png-bytes'], { type: 'image/png' });
    });
    const toasts: Array<{ payload: { message: { values: unknown[] } } }> = [];
    const off = app.emitter.on({ openToast: action => toasts.push(action) });

    createExportMenus(app, () => {}, theme)[2].onClick();
    await flush();

    expect(exported).toHaveLength(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].payload.message.values).toContain(
      '20000x20000 is past what a browser canvas can hold, so the image is 16384x16384'
    );
    off();
  });

  it('says nothing when the image kept every pixel of the document', async () => {
    const toasts: unknown[] = [];
    const off = app.emitter.on({ openToast: action => toasts.push(action) });

    createExportMenus(app, () => {}, theme)[2].onClick();
    await flush();

    expect(exported).toHaveLength(1);
    expect(toasts).toEqual([]);
    off();
  });

  it('says the png is being generated while the render runs long', async () => {
    vi.useFakeTimers();
    const render = createDeferred<Blob>();
    vi.mocked(createDocumentPng).mockReturnValueOnce(render.promise);
    const log: string[] = [];
    const off = recordToasts(app, log);

    createExportMenus(app, () => {}, theme)[2].onClick();
    await vi.advanceTimersByTimeAsync(399);
    expect(log).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(log).toEqual(['open Generating the png']);
    expect(exported).toHaveLength(0);

    render.resolve(png());
    await vi.advanceTimersByTimeAsync(600);
    off();
  });

  it('says nothing about generating when the render is quick', async () => {
    const log: string[] = [];
    const off = recordToasts(app, log);

    createExportMenus(app, () => {}, theme)[2].onClick();
    await flush();

    expect(exported).toHaveLength(1);
    expect(log).toEqual([]);
    off();
  });

  it('keeps the generating toast up until the file exists', async () => {
    vi.useFakeTimers();
    const render = createDeferred<Blob>();
    vi.mocked(createDocumentPng).mockReturnValueOnce(render.promise);
    const log: string[] = [];
    const off = recordToasts(app, log);

    createExportMenus(app, () => {}, theme)[2].onClick();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(log).toEqual(['open Generating the png']);
    expect(exported).toHaveLength(0);

    render.resolve(png());
    await vi.advanceTimersByTimeAsync(600);

    expect(log).toEqual([
      'open Generating the png',
      'close Generating the png',
    ]);
    expect(exported).toHaveLength(1);
    off();
  });

  it('takes the generating toast away before saying the image was scaled down', async () => {
    vi.useFakeTimers();
    const render = createDeferred<void>();
    vi.mocked(createDocumentPng).mockImplementationOnce(async options => {
      await render.promise;
      options.onResolutionReduced?.({
        documentWidth: 20_000,
        documentHeight: 20_000,
        width: 16_384,
        height: 16_384,
      });
      return png();
    });
    const log: string[] = [];
    const off = recordToasts(app, log);

    createExportMenus(app, () => {}, theme)[2].onClick();
    await vi.advanceTimersByTimeAsync(400);
    render.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(log).toEqual([
      'open Generating the png',
      'close Generating the png',
      'open Exported at a reduced resolution | 20000x20000 is past what a browser canvas can hold, so the image is 16384x16384',
    ]);
    expect(exported).toHaveLength(1);
    off();
  });

  it('takes the generating toast away before saying the export failed', async () => {
    vi.useFakeTimers();
    const render = createDeferred<Blob>();
    vi.mocked(createDocumentPng).mockReturnValueOnce(render.promise);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const off = recordToasts(app, log);

    createExportMenus(app, () => {}, theme)[2].onClick();
    await vi.advanceTimersByTimeAsync(400);
    render.reject(new Error('no canvas'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(log).toEqual([
      'open Generating the png',
      'close Generating the png',
      'open Failed to export the document as a png',
    ]);
    expect(exported).toHaveLength(0);
    expect(error).toHaveBeenCalledTimes(1);
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
