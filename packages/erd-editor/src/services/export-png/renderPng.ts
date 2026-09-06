import type { Theme } from '@/themes/tokens';

import { renderDocumentScene } from './documentScene';
import { fitPixelRatio } from './pixelRatio';
import type { ToWidth } from './textWidth';

/** The box that was asked for and the raster that fitted inside a canvas. */
export type ResolutionReduction = {
  documentWidth: number;
  documentHeight: number;
  width: number;
  height: number;
};

/** Everything a png needs that survives a structured clone to another realm. */
export type RenderPngRequest = {
  doc: string;
  theme: Theme;
  pixelRatio: number;
};

export type RenderPngResult = {
  blob: Blob;
  width: number;
  height: number;
  /**
   * Null when the box kept every pixel it was written with. A realm that drew
   * the image is the only one that knows this, so it is carried back rather
   * than recomputed by whoever asked for the file.
   */
  reduction: ResolutionReduction | null;
};

type PngCanvas = HTMLCanvasElement | OffscreenCanvas;

function toPngBlob(canvas: PngCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      blob
        ? resolve(blob)
        : reject(new Error('[export-png] the canvas encoded no png'));
    }, 'image/png');
  });
}

/**
 * The whole document rastered, in whichever realm calls it. Nothing here reads
 * a window, a screen or a stylesheet, so the same code answers on the main
 * thread and inside the worker that keeps the main thread free.
 *
 * @example
 * const { blob } = await renderDocumentPng({ doc, theme, pixelRatio: 1, toWidth });
 */
export async function renderDocumentPng({
  doc,
  theme,
  pixelRatio,
  toWidth,
}: RenderPngRequest & { toWidth: ToWidth }): Promise<RenderPngResult> {
  const scene = await renderDocumentScene({ doc, theme, toWidth });

  try {
    // A stage rasterises at its own box times the ratio, so the ratio is fitted
    // to the Stage rather than to the scene box the Stage was sized from.
    const ratio = fitPixelRatio(
      pixelRatio,
      scene.stage.width(),
      scene.stage.height()
    );

    const canvas = scene.stage.toCanvas({ pixelRatio: ratio }) as PngCanvas;
    const blob = await toPngBlob(canvas);
    const { width, height } = canvas;
    // Both reductions in one number: the Stage the box was already scaled onto,
    // and the raster of that Stage. Compared as factors rather than as pixels,
    // which a canvas rounds to whole ones and a scene box does not.
    const drawn = scene.scale * ratio;

    return {
      blob,
      width,
      height,
      reduction:
        drawn < pixelRatio
          ? {
              documentWidth: scene.box.width,
              documentHeight: scene.box.height,
              width,
              height,
            }
          : null,
    };
  } finally {
    scene.destroy();
  }
}
