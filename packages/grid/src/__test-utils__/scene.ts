import { currentEpoch, whenDrawn } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';

/** Resolves on the next animation frame, behind any konva asked for before it. */
export const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

/**
 * Waits until the scene has drawn and stays drawn: whenDrawn resolves as konva
 * books a frame, and a draw out of measurements books another, so it waits a
 * frame per commit until two in a row leave the commit counter unmoved.
 */
export async function drawn(): Promise<void> {
  let before = -1;

  for (;;) {
    await whenDrawn();
    await nextFrame();

    const now = currentEpoch();
    if (now === before) return;
    before = now;
  }
}

/** One pixel of a layer's canvas at a stage point, as [r, g, b, a]. */
export function pixelAt(layer: Layer, x: number, y: number): number[] {
  const canvas = layer.getCanvas();
  const ratio = canvas.getPixelRatio();
  const data = canvas
    .getContext()
    .getImageData(Math.floor(x * ratio), Math.floor(y * ratio), 1, 1).data;

  return [data[0], data[1], data[2], data[3]];
}

/** A theme colour, #rrggbb or #rrggbbaa, as the [r, g, b, a] a canvas reads back. */
export function rgba(hex: string): number[] {
  const value = hex.slice(1);
  const channel = (index: number) =>
    parseInt(value.slice(index * 2, index * 2 + 2), 16);

  return [
    channel(0),
    channel(1),
    channel(2),
    value.length > 6 ? channel(3) : 255,
  ];
}

/** Whether two colours differ by no more than the tolerance in any channel. */
export const near = (actual: number[], expected: number[], tolerance = 2) =>
  actual.every(
    (value, index) => Math.abs(value - expected[index]) <= tolerance
  );
