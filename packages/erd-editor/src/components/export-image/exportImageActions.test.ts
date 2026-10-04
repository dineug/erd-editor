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
  copyImagePng,
  describeReduction,
  exportImagePng,
  type ImageRequest,
} from '@/components/export-image/exportImageActions';
import {
  createDocumentPng,
  type ResolutionReduction,
} from '@/services/export-png';
import type { Theme } from '@/themes/tokens';
import { copyImageToClipboard } from '@/utils/clipboard';
import { setExportFileCallback } from '@/utils/file/exportFile';

vi.mock('@/services/export-png', () => ({
  createDocumentPng: vi.fn(
    async () => new Blob(['png-bytes'], { type: 'image/png' })
  ),
}));

vi.mock('@/utils/clipboard', () => ({
  copyImageToClipboard: vi.fn(async (createPng: () => Promise<Blob>) => {
    await createPng();
  }),
}));

const theme = { canvasBackground: '#101112' } as Theme;

const REDUCTION: ResolutionReduction = {
  // The box is the content plus a margin in scene units, so it arrives
  // fractional and is rounded to the whole units the message reads in.
  documentWidth: 20_378.5,
  documentHeight: 20_000.4,
  width: 16_384,
  height: 16_384,
};

const REDUCED_TEXT =
  'The document is 20379x20000, past what a browser canvas can hold, so the PNG is 16384x16384';

let app: AppContext;
let exported: Array<{ type: string; fileName: string }>;

const request = (): ImageRequest => ({
  doc: '{"doc":{}}',
  theme,
  toWidth: app.toWidth,
  zoomLevel: 0.75,
  pixelRatio: 2,
});

beforeEach(() => {
  app = createTestAppContext();
  exported = [];
  setExportFileCallback((blob, options) => {
    exported.push({ type: blob.type, fileName: options.fileName });
  });
  vi.mocked(createDocumentPng).mockClear();
  vi.mocked(copyImageToClipboard).mockClear();
});

afterEach(() => {
  setExportFileCallback(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
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
function recordToasts(log: string[]) {
  return app.emitter.on({
    openToast: ({ payload }) => {
      const label = labelOf(payload);
      log.push(`open ${label}`);
      payload.close?.then(() => log.push(`close ${label}`));
    },
  });
}

describe('describeReduction', () => {
  it('rounds the document box and names the raster the png came out at', () => {
    expect(describeReduction(REDUCTION)).toBe(REDUCED_TEXT);
  });
});

describe('exportImagePng', () => {
  it('draws the request it is given into a png named after the database', async () => {
    await exportImagePng(app, request(), 'shop');

    const [options] = vi.mocked(createDocumentPng).mock.calls[0];
    expect(options).toMatchObject({
      doc: '{"doc":{}}',
      theme,
      zoomLevel: 0.75,
      pixelRatio: 2,
    });
    expect(options.toWidth).toBe(app.toWidth);
    expect(exported).toHaveLength(1);
    expect(exported[0].type).toBe('image/png');
    expect(exported[0].fileName).toMatch(/^shop-.*\.png$/);
  });

  it('says nothing when the image kept every pixel and drew quickly', async () => {
    const log: string[] = [];
    const off = recordToasts(log);

    await exportImagePng(app, request(), 'shop');
    await flush();

    expect(exported).toHaveLength(1);
    expect(log).toEqual([]);
    off();
  });

  it('reports rather than swallows a render failure, and writes no file', async () => {
    vi.mocked(createDocumentPng).mockRejectedValueOnce(new Error('no canvas'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const off = recordToasts(log);

    await exportImagePng(app, request(), 'shop');

    expect(exported).toHaveLength(0);
    expect(error).toHaveBeenCalledTimes(1);
    expect(log).toEqual([
      "open Couldn't export the PNG | See the browser console for the error",
    ]);
    off();
  });

  it('tells the user what it gave up when the image is scaled down', async () => {
    vi.mocked(createDocumentPng).mockImplementationOnce(async options => {
      options.onResolutionReduced?.(REDUCTION);
      return png();
    });
    const log: string[] = [];
    const off = recordToasts(log);

    await exportImagePng(app, request(), 'shop');

    expect(exported).toHaveLength(1);
    expect(log).toEqual([
      `open Exported at a reduced resolution | ${REDUCED_TEXT}`,
    ]);
    off();
  });

  it('keeps the generating toast up until the file exists, then takes it away first', async () => {
    vi.useFakeTimers();
    const render = createDeferred<void>();
    vi.mocked(createDocumentPng).mockImplementationOnce(async options => {
      await render.promise;
      options.onResolutionReduced?.(REDUCTION);
      return png();
    });
    const log: string[] = [];
    const off = recordToasts(log);

    const done = exportImagePng(app, request(), 'shop');
    await vi.advanceTimersByTimeAsync(399);
    expect(log).toEqual([]);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(log).toEqual(['open Exporting PNG…']);
    expect(exported).toHaveLength(0);

    render.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(log).toEqual([
      'open Exporting PNG…',
      'close Exporting PNG…',
      `open Exported at a reduced resolution | ${REDUCED_TEXT}`,
    ]);
    expect(exported).toHaveLength(1);
    off();
  });
});

describe('copyImagePng', () => {
  it('hands the clipboard a png drawn from the request, before anything is awaited', () => {
    copyImagePng(app, request());

    // The write has to start inside the click, so it is asked for at once.
    expect(copyImageToClipboard).toHaveBeenCalledTimes(1);
    expect(createDocumentPng).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createDocumentPng).mock.calls[0][0]).toMatchObject({
      doc: '{"doc":{}}',
      theme,
      zoomLevel: 0.75,
      pixelRatio: 2,
    });
  });

  it('says the image is on the clipboard and writes no file', async () => {
    const log: string[] = [];
    const off = recordToasts(log);

    await copyImagePng(app, request());

    expect(log).toEqual(['open Copied the image to the clipboard']);
    expect(exported).toEqual([]);
    off();
  });

  it('says what it gave up when the copied image is scaled down', async () => {
    vi.mocked(createDocumentPng).mockImplementationOnce(async options => {
      options.onResolutionReduced?.(REDUCTION);
      return png();
    });
    const log: string[] = [];
    const off = recordToasts(log);

    await copyImagePng(app, request());

    expect(log).toEqual([
      `open Copied at a reduced resolution | ${REDUCED_TEXT}`,
    ]);
    off();
  });

  it('tells the user to save a PNG when the clipboard refuses', async () => {
    const denied = new Error('NotAllowedError');
    vi.mocked(copyImageToClipboard).mockRejectedValueOnce(denied);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const off = recordToasts(log);

    await copyImagePng(app, request());

    expect(log).toEqual([
      "open Couldn't copy the image | Save it as a PNG instead",
    ]);
    expect(error).toHaveBeenCalledWith(
      '[export-png] the image could not be copied',
      denied
    );
    off();
  });

  it('logs why the drawing failed rather than the refusal it caused', async () => {
    const broken = new Error('no canvas');
    vi.mocked(createDocumentPng).mockRejectedValueOnce(broken);
    // A clipboard answers a failed image with a refusal of its own.
    vi.mocked(copyImageToClipboard).mockImplementationOnce(async createPng => {
      await createPng().catch(() => {});
      throw new Error('NotAllowedError');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const off = recordToasts(log);

    await copyImagePng(app, request());

    expect(log).toEqual([
      "open Couldn't copy the image | Save it as a PNG instead",
    ]);
    expect(error).toHaveBeenCalledWith(
      '[export-png] the image could not be copied',
      broken
    );
    off();
  });

  it('says it is copying while the image runs long, and takes that away first', async () => {
    vi.useFakeTimers();
    const render = createDeferred<Blob>();
    vi.mocked(createDocumentPng).mockReturnValueOnce(render.promise);
    const log: string[] = [];
    const off = recordToasts(log);

    const done = copyImagePng(app, request());
    await vi.advanceTimersByTimeAsync(400);
    expect(log).toEqual(['open Copying image…']);

    render.resolve(png());
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(log).toEqual([
      'open Copying image…',
      'close Copying image…',
      'open Copied the image to the clipboard',
    ]);
    off();
  });
});
