// AC-G24 (F-2): the line the scene draws a memo body on, and the line a dom
// line box of that leading puts its own on. The leading is a layout metric and
// the baseline a canvas one, which only a headed browser tells apart.

import { describe, expect, it } from 'vite-plus/test';

import {
  getMemoLineHeight,
  getMemoLineHeightPx,
  getMemoTextBaseline,
  MEMO_FONT,
  MEMO_FONT_WEIGHT,
} from '@/components/erd/canvas/memo/memoText';
import {
  getSceneFontMetrics,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneFontMetrics,
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
  canvas.height = Math.ceil(getMemoLineHeightPx()) * RASTER_SCALE;

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
    height: Math.ceil(getMemoLineHeightPx()),
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
      lineHeight: getMemoLineHeight(),
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

/** How many folded lines the dom probe below lays out and measures. */
const LINES = 4;

/**
 * Where a dom line box of the memo's own leading puts the baseline of each
 * line. No api hands a baseline out, so the only way to one is to lay the lines
 * out and read a zero sized inline box aligned to it.
 */
function domBaselines(count: number): number[] {
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;top:-10000px;left:0;width:${BOX_WIDTH}px;margin:0;padding:0;border:0;font:${MEMO_FONT};line-height:${getMemoLineHeightPx()}px;white-space:pre-wrap`;
  document.body.append(box);

  const markers: HTMLElement[] = [];
  for (let line = 0; line < count; line++) {
    if (line) box.append(document.createTextNode('\n'));
    box.append(document.createTextNode(SAMPLE));
    const marker = document.createElement('span');
    marker.style.cssText =
      'display:inline-block;width:0;height:0;vertical-align:baseline';
    box.append(marker);
    markers.push(marker);
  }

  const top = box.getBoundingClientRect().top;
  const baselines = markers.map(
    marker => marker.getBoundingClientRect().bottom - top
  );
  box.remove();

  return baselines;
}

/**
 * The ascent and descent blink lays a line box out by, which is a different
 * pair from the one a canvas reports. Nothing hands them over, so the way to
 * them is a box left at line-height normal, whose height is the two together.
 */
function layoutFontMetrics(): SceneFontMetrics {
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;top:-10000px;left:0;width:${BOX_WIDTH}px;margin:0;padding:0;border:0;font:${MEMO_FONT};line-height:normal;white-space:pre`;
  box.append(document.createTextNode(SAMPLE));
  const marker = document.createElement('span');
  marker.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:baseline';
  box.append(marker);
  document.body.append(box);

  const rect = box.getBoundingClientRect();
  const ascent = marker.getBoundingClientRect().bottom - rect.top;
  const metrics = { ascent, descent: rect.height - ascent };
  box.remove();

  return metrics;
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

  it('is the line a dom line box of that leading puts every line on', () => {
    const baselines = domBaselines(LINES);
    const leading = getMemoLineHeightPx();
    const baseline = getMemoTextBaseline();

    expect(baseline).toBeGreaterThan(0);
    baselines.forEach((at, line) => {
      expect(at, `line ${line}`).toBe(line * leading + baseline);
    });
  });

  it('holds at any leading, because both pairs sit the same way about it', () => {
    const canvas = getSceneFontMetrics();
    const layout = layoutFontMetrics();

    // A line box puts its baseline at half the leading plus half of ascent
    // less descent, and so does konva. Only that difference is shared, which
    // is why the leading is free to be the layout advance rather than the sum.
    expect(canvas.ascent - canvas.descent).toBe(layout.ascent - layout.descent);
  });

  it('takes the leading a textarea of the same face lays out', () => {
    const area = document.createElement('textarea');
    area.style.cssText = `position:absolute;top:-10000px;left:0;width:${BOX_WIDTH}px;margin:0;padding:0;border:0;overflow:hidden;resize:none;box-sizing:border-box;font:${MEMO_FONT};white-space:pre-wrap`;
    area.value = Array.from({ length: LINES }, () => SAMPLE).join('\n');
    document.body.append(area);
    const advance = area.scrollHeight / LINES;
    area.remove();

    expect(getMemoLineHeightPx()).toBe(advance);
  });
});
