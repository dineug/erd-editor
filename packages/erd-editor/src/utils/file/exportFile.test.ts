import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createDocumentPng, createDocumentSvg } from '@/services/export-png';
import {
  exportCode,
  exportJSON,
  exportPNG,
  exportSchemaSQL,
  exportSVG,
  setExportFileCallback,
} from '@/utils/file/exportFile';

vi.mock('@/services/export-png', () => ({
  createDocumentPng: vi.fn(),
  createDocumentSvg: vi.fn(),
}));

const createDocumentPngMock = vi.mocked(createDocumentPng);
const createDocumentSvgMock = vi.mocked(createDocumentSvg);

const pngRequest = () => ({
  doc: '{"version":"3.0.0"}',
  theme: { canvasBackground: '#000000' } as any,
  toWidth: (text: string) => text.length,
});

const FIXED_TIME = new Date(2024, 2, 9, 4, 5, 6);
const STAMP = '2024-03-09T04_05_06';

async function readBlob(blob: Blob) {
  return await blob.text();
}

describe('exportFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    createDocumentPngMock.mockReset();
    createDocumentSvgMock.mockReset();
  });

  afterEach(() => {
    setExportFileCallback(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('exportJSON', () => {
    it('routes the blob to the registered callback with a name-prefixed file name', async () => {
      const calls: Array<[Blob, { fileName: string }]> = [];
      setExportFileCallback((blob, options) => calls.push([blob, options]));

      exportJSON('{"a":1}', 'my-schema');

      expect(calls).toHaveLength(1);
      const [blob, options] = calls[0];
      expect(await readBlob(blob)).toBe('{"a":1}');
      expect(blob.type).toBe('application/json');
      expect(options.fileName).toBe(`my-schema-${STAMP}.erd.json`);
    });

    it('falls back to "unnamed" when no name is given', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}');

      expect(calls[0].fileName).toBe(`unnamed-${STAMP}.erd.json`);
    });

    it('falls back to "unnamed" when the name is only whitespace', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', '   ');

      expect(calls[0].fileName).toBe(`unnamed-${STAMP}.erd.json`);
    });

    it('keeps the untrimmed name when it has non-whitespace content', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', ' a ');

      expect(calls[0].fileName).toBe(` a -${STAMP}.erd.json`);
    });
  });

  describe('file name', () => {
    it('writes two-digit fields as they stand and drops the milliseconds', () => {
      vi.setSystemTime(new Date(2025, 11, 31, 23, 59, 58, 999));
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', 'a');

      expect(calls[0].fileName).toBe('a-2025-12-31T23_59_58.erd.json');
    });

    it('pads a year below 1000 to four digits', () => {
      vi.setSystemTime(new Date(987, 0, 2, 3, 4, 5));
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', 'a');

      expect(calls[0].fileName).toBe('a-0987-01-02T03_04_05.erd.json');
    });
  });

  describe('exportSchemaSQL', () => {
    it('creates an untyped blob with a .sql file name', async () => {
      const calls: Array<[Blob, { fileName: string }]> = [];
      setExportFileCallback((blob, options) => calls.push([blob, options]));

      exportSchemaSQL('CREATE TABLE a;', 'db');

      const [blob, options] = calls[0];
      expect(await readBlob(blob)).toBe('CREATE TABLE a;');
      expect(blob.type).toBe('');
      expect(options.fileName).toBe(`db-${STAMP}.sql`);
    });
  });

  describe('exportCode', () => {
    it('names the code by the database and the extension it is handed, untyped as SQL is', async () => {
      const calls: Array<[Blob, { fileName: string }]> = [];
      setExportFileCallback((blob, options) => calls.push([blob, options]));

      exportCode('export interface A {}\n', '.ts', 'shop');
      exportCode('{}', '.json', '  ');

      const [blob, options] = calls[0];
      expect(await readBlob(blob)).toBe('export interface A {}\n');
      expect(blob.type).toBe('');
      expect(options.fileName).toBe(`shop-${STAMP}.ts`);
      expect(calls[1][1].fileName).toBe(`unnamed-${STAMP}.json`);
    });
  });

  describe('exportPNG', () => {
    it('exports the blob the document renderer produced', async () => {
      const png = new Blob(['png'], { type: 'image/png' });
      createDocumentPngMock.mockResolvedValue(png);
      const calls: Array<[Blob, { fileName: string }]> = [];
      setExportFileCallback((blob, options) => calls.push([blob, options]));

      const request = pngRequest();
      await exportPNG(request, 'diagram');

      expect(createDocumentPngMock).toHaveBeenCalledWith(request);
      expect(calls[0][0]).toBe(png);
      expect(calls[0][1].fileName).toBe(`diagram-${STAMP}.png`);
    });

    it('renders from the document rather than from anything on screen', async () => {
      createDocumentPngMock.mockResolvedValue(
        new Blob(['png'], { type: 'image/png' })
      );
      setExportFileCallback(() => {});

      await exportPNG(pngRequest());

      const [request] = createDocumentPngMock.mock.calls[0];
      expect(request.doc).toBe('{"version":"3.0.0"}');
      expect(Reflect.has(request, 'root')).toBe(false);
    });

    it('rejects rather than writing a file when the render fails', async () => {
      createDocumentPngMock.mockRejectedValue(new Error('no offscreen canvas'));
      const callback = vi.fn();
      setExportFileCallback(callback);

      await expect(exportPNG(pngRequest())).rejects.toThrow(
        'no offscreen canvas'
      );
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('exportSVG', () => {
    it('writes the svg the document renderer produced as an svg file', async () => {
      createDocumentSvgMock.mockResolvedValue('<svg/>');
      const calls: Array<[Blob, { fileName: string }]> = [];
      setExportFileCallback((blob, options) => calls.push([blob, options]));

      const request = pngRequest();
      await exportSVG(request, 'diagram');

      expect(createDocumentSvgMock).toHaveBeenCalledWith(request);
      const [blob, options] = calls[0];
      expect(blob.type).toBe('image/svg+xml');
      expect(await readBlob(blob)).toBe('<svg/>');
      expect(options.fileName).toBe(`diagram-${STAMP}.svg`);
    });

    it('rejects rather than writing a file when the render fails', async () => {
      createDocumentSvgMock.mockRejectedValue(new Error('no scene'));
      const callback = vi.fn();
      setExportFileCallback(callback);

      await expect(exportSVG(pngRequest())).rejects.toThrow('no scene');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('built-in export', () => {
    it('creates an anchor with an object URL and clicks it', async () => {
      const anchor = document.createElement('a');
      const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
      const createElement = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(anchor as any);
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');

      exportJSON('{"a":1}', 'built-in');

      expect(createElement).toHaveBeenCalledWith('a');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(await readBlob(createObjectURL.mock.calls[0][0] as Blob)).toBe(
        '{"a":1}'
      );
      expect(anchor.getAttribute('href')).toBe('blob:mock-url');
      expect(anchor.download).toBe(`built-in-${STAMP}.erd.json`);
      expect(click).toHaveBeenCalledTimes(1);
    });

    it('is restored after the callback is cleared', () => {
      const callback = vi.fn();
      setExportFileCallback(callback);
      setExportFileCallback(null);

      const anchor = document.createElement('a');
      vi.spyOn(anchor, 'click').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(anchor as any);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

      exportSchemaSQL('select 1;');

      expect(callback).not.toHaveBeenCalled();
      expect(anchor.download).toBe(`unnamed-${STAMP}.sql`);
    });
  });
});
