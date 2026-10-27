import { createSchema, toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';

import { TRANSPARENT_BACKGROUND } from './exportTheme';
import { toImage, type ToImageOptions } from './toImage';

vi.mock('./index', () => ({
  createDocumentPng: vi.fn(async () => new Blob(['png'])),
  createDocumentSvg: vi.fn(async () => '<svg />'),
}));

const { createDocumentPng, createDocumentSvg } = await import('./index');

const drawPng = vi.mocked(createDocumentPng);
const drawSvg = vi.mocked(createDocumentSvg);

const doc = toJson(createSchema());

const presetOf = (appearance: Appearance) =>
  createTheme({
    grayColor: GrayColor.slate,
    accentColor: AccentColor.indigo,
    appearance,
  });

afterEach(() => {
  drawPng.mockClear();
  drawSvg.mockClear();
  vi.unstubAllGlobals();
});

describe('toImage', () => {
  it('draws a png with the dialog’s opening options, light and at 2x', async () => {
    const blob = await toImage(doc, { format: 'png' });

    expect(blob).toBeInstanceOf(Blob);
    expect(drawSvg).not.toHaveBeenCalled();
    expect(drawPng).toHaveBeenCalledTimes(1);

    const [request] = drawPng.mock.calls[0];
    expect(request).toEqual({
      doc,
      theme: presetOf(Appearance.light),
      toWidth: expect.any(Function),
      pixelRatio: 2,
    });
    expect(request.toWidth('ERD')).toBeTypeOf('number');
  });

  it('draws an svg with no scale, whatever scale it is handed', async () => {
    const svg = await toImage(doc, { format: 'svg', scale: 3 });

    expect(svg).toBe('<svg />');
    expect(drawPng).not.toHaveBeenCalled();
    expect(drawSvg).toHaveBeenCalledWith({
      doc,
      theme: presetOf(Appearance.light),
      toWidth: expect.any(Function),
    });
  });

  it.each([1, 2, 3] as const)('hands the png scale %i on', async scale => {
    await toImage(doc, { format: 'png', scale });

    expect(drawPng.mock.calls[0][0].pixelRatio).toBe(scale);
  });

  it('draws the dark preset of the same gray and accent in dark mode', async () => {
    await toImage(doc, { format: 'svg', darkMode: true });

    expect(drawSvg.mock.calls[0][0].theme).toEqual(presetOf(Appearance.dark));
  });

  it('takes the canvas colour away with the background off, and nothing else', async () => {
    await toImage(doc, { format: 'png', background: false, darkMode: true });

    expect(drawPng.mock.calls[0][0].theme).toEqual({
      ...presetOf(Appearance.dark),
      canvasBackground: TRANSPARENT_BACKGROUND,
    });
  });

  it('draws an empty document for empty text, as the viewer loads one', async () => {
    await toImage('  ', { format: 'svg' });

    expect(JSON.parse(drawSvg.mock.calls[0][0].doc)).toEqual(
      JSON.parse(toJson(createSchema()))
    );
  });

  it.each<[string, Partial<Record<keyof ToImageOptions, unknown>>]>([
    ['format', { format: 'jpeg' }],
    ['format', {}],
    ['background', { format: 'png', background: 'false' }],
    ['darkMode', { format: 'png', darkMode: 1 }],
    ['scale', { format: 'png', scale: 4 }],
    ['scale', { format: 'png', scale: 1.5 }],
    ['scale', { format: 'svg', scale: '2' }],
  ])(
    'refuses a %s the dialog does not offer, drawing nothing: %j',
    async (name, options) => {
      await expect(
        toImage(doc, options as unknown as ToImageOptions)
      ).rejects.toThrow(new RegExp(`^toImage: ${name} cannot be`));

      expect(drawPng).not.toHaveBeenCalled();
      expect(drawSvg).not.toHaveBeenCalled();
    }
  );

  it('refuses a value that is not text, which a parsed object would be', async () => {
    await expect(
      toImage(JSON.parse(doc) as unknown as string, { format: 'png' })
    ).rejects.toThrow(TypeError);

    expect(drawPng).not.toHaveBeenCalled();
  });

  it('refuses text that holds no document before drawing anything', async () => {
    await expect(toImage('{ not json', { format: 'svg' })).rejects.toThrow(
      SyntaxError
    );

    expect(drawSvg).not.toHaveBeenCalled();
  });

  it('refuses a realm with no document, since it draws on a canvas', async () => {
    vi.stubGlobal('document', undefined);

    await expect(toImage(doc, { format: 'png' })).rejects.toThrow(
      'toImage needs a browser'
    );

    expect(drawPng).not.toHaveBeenCalled();
  });
});
