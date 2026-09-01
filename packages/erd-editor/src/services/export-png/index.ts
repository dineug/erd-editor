import type { Theme } from '@/themes/tokens';

import { renderDocumentScene } from './documentScene';
import { fitPixelRatio } from './pixelRatio';

export type DocumentPngOptions = {
  doc: string;
  theme: Theme;
  /**
   * How the editor measures a string. Passed in rather than built here so the
   * image is laid out by the same measurement the document was written with.
   */
  toWidth: (text: string) => number;
  pixelRatio?: number;
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
}: DocumentPngOptions): Promise<Blob> {
  // A face still loading measures differently from the one the document was
  // laid out with, and the image keeps whichever was in place when it was drawn.
  await document.fonts?.ready;

  const scene = await renderDocumentScene({ doc, theme, toWidth });

  try {
    // A stage rasterises at its own box times the ratio, so the box is read
    // back off the stage rather than recomputed from the document here.
    const ratio = fitPixelRatio(
      pixelRatio,
      scene.stage.width(),
      scene.stage.height()
    );

    return await toBlob(scene.stage.toCanvas({ pixelRatio: ratio }));
  } finally {
    scene.destroy();
  }
}
