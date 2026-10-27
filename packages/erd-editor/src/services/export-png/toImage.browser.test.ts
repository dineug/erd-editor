import { describe, expect, it } from 'vite-plus/test';

import { toImage } from '@/index';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';

/** A document of one table and one memo, saved zoomed out. */
const doc = JSON.stringify({
  version: '3.0.0',
  settings: { zoomLevel: 0.5, databaseName: 'image', lockSettings: 0 },
  doc: {
    tableIds: ['users'],
    relationshipIds: [],
    indexIds: [],
    memoIds: ['note'],
  },
  collections: {
    tableEntities: {
      users: {
        id: 'users',
        name: 'users',
        comment: '',
        columnIds: [],
        seqColumnIds: [],
        ui: { x: 40, y: 40, zIndex: 2, widthName: 60, widthComment: 60 },
      },
    },
    tableColumnEntities: {},
    relationshipEntities: {},
    indexEntities: {},
    indexColumnEntities: {},
    memoEntities: {
      note: {
        id: 'note',
        value: '',
        ui: { x: 400, y: 40, width: 200, height: 120, zIndex: 2 },
      },
    },
  },
});

async function pngOf(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);

  return {
    width: bitmap.width,
    height: bitmap.height,
    /** The corner pixel, which the margin leaves to the canvas colour alone. */
    corner: Array.from(context.getImageData(1, 1, 1, 1).data),
  };
}

/** The pixel a colour paints opaque, as the canvas reads it. */
function pixelOf(color: string) {
  const context = new OffscreenCanvas(1, 1).getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data);
}

const canvasColorOf = (appearance: Appearance) =>
  createTheme({
    grayColor: GrayColor.slate,
    accentColor: AccentColor.indigo,
    appearance,
  }).canvasBackground;

describe('toImage from the package root', () => {
  it('draws a png at the scale asked, 2x by default', async () => {
    const one = await pngOf(await toImage(doc, { format: 'png', scale: 1 }));
    const two = await pngOf(await toImage(doc, { format: 'png' }));
    const three = await pngOf(await toImage(doc, { format: 'png', scale: 3 }));

    expect(one.width).toBeGreaterThan(0);
    expect(two).toMatchObject({ width: one.width * 2, height: one.height * 2 });
    expect(three).toMatchObject({
      width: one.width * 3,
      height: one.height * 3,
    });
  });

  it('paints the light canvas colour behind by default, the dark one in dark mode', async () => {
    const light = await pngOf(await toImage(doc, { format: 'png', scale: 1 }));
    const dark = await pngOf(
      await toImage(doc, { format: 'png', scale: 1, darkMode: true })
    );

    expect(light.corner).toEqual(pixelOf(canvasColorOf(Appearance.light)));
    expect(dark.corner).toEqual(pixelOf(canvasColorOf(Appearance.dark)));
  });

  it('leaves the png transparent behind the diagram with the background off', async () => {
    const png = await pngOf(
      await toImage(doc, { format: 'png', scale: 1, background: false })
    );

    expect(png.corner[3]).toBe(0);
  });

  it('writes an svg of the same box at 100%, its names as text', async () => {
    const png = await pngOf(await toImage(doc, { format: 'png', scale: 1 }));
    const svg = await toImage(doc, { format: 'svg' });

    const root = new DOMParser().parseFromString(svg, 'image/svg+xml')
      .documentElement as unknown as SVGSVGElement;
    expect(root.tagName).toBe('svg');
    expect(Number(root.getAttribute('width'))).toBeCloseTo(png.width, 0);
    expect(Number(root.getAttribute('height'))).toBeCloseTo(png.height, 0);
    expect(
      Array.from(root.querySelectorAll('text'), text => text.textContent)
    ).toContain('users');
  });
});
