import type { Theme } from '@/themes/tokens';

import { renderDocumentScene } from './documentScene';
import { fitPixelRatio } from './pixelRatio';

/** The box that was asked for and the raster that fitted inside a canvas. */
export type ResolutionReduction = {
  documentWidth: number;
  documentHeight: number;
  width: number;
  height: number;
};

export type DocumentPngOptions = {
  doc: string;
  theme: Theme;
  /**
   * How the editor measures a string. Passed in rather than built here so the
   * image is laid out by the same measurement the document was written with.
   */
  toWidth: (text: string) => number;
  pixelRatio?: number;
  /**
   * Called once, after a file exists, when the box outran what a canvas holds
   * and the image had to be scaled down. A caller with somewhere to put it is
   * what turns a silent loss of resolution into something the author is told.
   */
  onResolutionReduced?: (reduction: ResolutionReduction) => void;
};

/**
 * One image pixel per canvas unit, so the png is exactly the canvas box for
 * every box a canvas can hold.
 */
const DEFAULT_PIXEL_RATIO = 1;

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      blob
        ? resolve(blob)
        : reject(new Error('[export-png] the canvas encoded no png'));
    }, 'image/png');
  });
}

/**
 * A png of the whole canvas box, whatever the editor is scrolled or zoomed to.
 * The scene is drawn again from the document rather than read off the screen,
 * which is what makes the image the same however the editor is being viewed.
 *
 * @example
 * const blob = await createDocumentPng({ doc: toJson(store.state), theme, toWidth });
 */
export async function createDocumentPng({
  doc,
  theme,
  toWidth,
  pixelRatio = DEFAULT_PIXEL_RATIO,
  onResolutionReduced,
}: DocumentPngOptions): Promise<Blob> {
  // A face still loading measures differently from the one the document was
  // laid out with, and the image keeps whichever was in place when it was drawn.
  await document.fonts?.ready;

  const scene = await renderDocumentScene({ doc, theme, toWidth });

  try {
    // A stage rasterises at its own box times the ratio, so the box is read
    // back off the stage rather than recomputed from the document here.
    const documentWidth = scene.stage.width();
    const documentHeight = scene.stage.height();
    const ratio = fitPixelRatio(pixelRatio, documentWidth, documentHeight);

    const canvas = scene.stage.toCanvas({ pixelRatio: ratio });
    const blob = await toBlob(canvas);

    if (ratio < pixelRatio) {
      onResolutionReduced?.({
        documentWidth,
        documentHeight,
        width: canvas.width,
        height: canvas.height,
      });
    }

    return blob;
  } finally {
    scene.destroy();
  }
}
