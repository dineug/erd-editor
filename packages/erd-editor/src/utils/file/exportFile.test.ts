import { DateTime } from 'luxon';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createDocumentPng } from '@/services/export-png';
import {
  exportJSON,
  exportPNG,
  exportSchemaSQL,
  setExportFileCallback,
} from '@/utils/file/exportFile';

vi.mock('@/services/export-png', () => ({
  createDocumentPng: vi.fn(),
}));

const createDocumentPngMock = vi.mocked(createDocumentPng);

const pngRequest = () => ({
  doc: '{"version":"3.0.0"}',
  theme: { canvasBackground: '#000000' } as any,
  toWidth: (text: string) => text.length,
});

const FIXED_TIME = new Date(2024, 2, 9, 4, 5, 6);

function nowPrefix() {
  return DateTime.now().toFormat(`yyyy-MM-dd'T'HH_mm_ss`);
}

async function readBlob(blob: Blob) {
  return await blob.text();
}

describe('exportFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    createDocumentPngMock.mockReset();
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
      expect(options.fileName).toBe(`my-schema-${nowPrefix()}.erd.json`);
    });

    it('falls back to "unnamed" when no name is given', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}');

      expect(calls[0].fileName).toBe(`unnamed-${nowPrefix()}.erd.json`);
    });

    it('falls back to "unnamed" when the name is only whitespace', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', '   ');

      expect(calls[0].fileName).toBe(`unnamed-${nowPrefix()}.erd.json`);
    });

    it('keeps the untrimmed name when it has non-whitespace content', () => {
      const calls: Array<{ fileName: string }> = [];
      setExportFileCallback((_blob, options) => calls.push(options));

      exportJSON('{}', ' a ');

      expect(calls[0].fileName).toBe(` a -${nowPrefix()}.erd.json`);
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
      expect(options.fileName).toBe(`db-${nowPrefix()}.sql`);
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
      expect(calls[0][1].fileName).toBe(`diagram-${nowPrefix()}.png`);
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
      expect(anchor.download).toBe(`built-in-${nowPrefix()}.erd.json`);
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
      expect(anchor.download).toBe(`unnamed-${nowPrefix()}.sql`);
    });
  });
});
