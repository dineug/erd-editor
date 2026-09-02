// AC-G24 (F-2): the line the scene draws a memo body on, and the whole pixel a
// dom line box paints its own on. The editor sits over the first and is laid out
// by the second, so nothing but drawing both says where either one lands.

import { describe, expect, it } from 'vite-plus/test';

import {
  getMemoTextBaseline,
  getMemoTextSnapOffset,
  MEMO_FONT,
  MEMO_FONT_WEIGHT,
  MEMO_LINE_HEIGHT,
  MEMO_LINE_HEIGHT_PX,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';

/** Ascenders and descenders both, so the ink says where the baseline ran. */
const SAMPLE = 'Hxpg';

const RASTER_SCALE = 4;

const BOX_WIDTH = 60;

/**
 * Where getMemoTextBaseline says the scene's first line sits, drawn straight
 * onto a canvas. Konva is the other half of the comparison, and neither one is
 * allowed to be the definition of the other.
 */
function drawBaselineText(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BOX_WIDTH * RASTER_SCALE;
  canvas.height = Math.ceil(MEMO_LINE_HEIGHT_PX) * RASTER_SCALE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context to draw the reference line');
  context.scale(RASTER_SCALE, RASTER_SCALE);
  context.font = MEMO_FONT;
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#fff';
  context.fillText(SAMPLE, 0, getMemoTextBaseline());

  return canvas;
}

/** The same string through konva, laid out the way a memo hands it over. */
async function drawKonvaText(): Promise<HTMLCanvasElement> {
  const { Stage } = await import('konva/lib/Stage');
  const { Layer } = await import('konva/lib/Layer');
  const { Text } = await import('konva/lib/shapes/Text');

  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({
    container,
    width: BOX_WIDTH,
    height: Math.ceil(MEMO_LINE_HEIGHT_PX),
  });
  const layer = new Layer();
  stage.add(layer);
  layer.add(
    new Text({
      x: 0,
      y: 0,
      text: SAMPLE,
      fill: '#fff',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      fontStyle: MEMO_FONT_WEIGHT,
      lineHeight: MEMO_LINE_HEIGHT,
      wrap: 'none',
    })
  );
  layer.draw();

  const canvas = stage.toCanvas({ pixelRatio: RASTER_SCALE });
  stage.destroy();
  container.remove();

  return canvas;
}

/** The pixel rows one crop of a canvas has ink in. */
function inkRows(canvas: HTMLCanvasElement): number[] {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context to read the drawn line back');

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const rows: number[] = [];

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += data[(y * width + x) * 4 + 3] / 255;
    rows.push(sum);
  }

  return rows;
}

/** Where the weight of an ink profile sits, which a sub-pixel shift moves. */
function centroidOf(rows: number[]): number {
  let weighted = 0;
  let total = 0;

  rows.forEach((row, index) => {
    weighted += row * index;
    total += row;
  });

  return total ? weighted / total : 0;
}

describe('the baseline the scene draws a memo body line on', () => {
  it('is the one getMemoTextBaseline hands the editor', async () => {
    const konva = inkRows(await drawKonvaText());
    const reference = inkRows(drawBaselineText());

    expect(konva.some(row => row > 0)).toBe(true);
    expect(
      Math.abs(centroidOf(konva) - centroidOf(reference)) / RASTER_SCALE
    ).toBeLessThan(0.05);
  });

  it('is the snap offset away from the whole pixel the dom paints on', () => {
    const baseline = getMemoTextBaseline();
    const offset = getMemoTextSnapOffset();

    expect(baseline).toBeGreaterThan(0);
    expect(Math.abs(offset)).toBeLessThanOrEqual(MEMO_LINE_HEIGHT_PX / 2);
    // Blink floors a line box's half leading to a whole pixel and rounds the
    // ascent it adds to one, so the baseline a textarea paints on is an
    // integer, and the offset is the whole of the distance to the scene's.
    expect(baseline - offset).toBe(Math.round(baseline - offset));
  });

  it('measures that offset once and hands the same number back', () => {
    expect(getMemoTextSnapOffset()).toBe(getMemoTextSnapOffset());
    expect(Number.isFinite(getMemoTextSnapOffset())).toBe(true);
  });
});
