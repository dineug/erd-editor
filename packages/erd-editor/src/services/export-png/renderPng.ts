import type { Theme } from '@/themes/tokens';

import { renderDocumentScene } from './documentScene';
import { type ExportSize, getExportSize } from './exportBox';
import { fitPixelRatio } from './pixelRatio';
import type { ToWidth } from './textWidth';

/**
 * The raster the zoom and scale asked for and the one that fitted inside a
 * canvas, in the very fields the export dialog reads its warning from.
 */
export type ResolutionReduction = Omit<ExportSize, 'reduced'>;

/** Everything a png needs that survives a structured clone to another realm. */
export type RenderPngRequest = {
  doc: string;
  theme: Theme;
  pixelRatio: number;
  /** The zoom to draw at; the document's own when the caller names none. */
  zoomLevel?: number;
  /**
   * The longest side the drawn box may take, in pixels, for an image that only
   * previews an export. Left out, the box is drawn at the zoom asked for.
   */
  maxSide?: number;
};

export type RenderPngResult = {
  blob: Blob;
  width: number;
  height: number;
  /** The box the image holds, in scene units, margin included. */
  documentWidth: number;
  documentHeight: number;
  /** The zoom the box was asked to be drawn at, which the scene read once loaded. */
  zoomLevel: number;
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
  zoomLevel,
  maxSide,
  toWidth,
}: RenderPngRequest & { toWidth: ToWidth }): Promise<RenderPngResult> {
  const scene = await renderDocumentScene({
    doc,
    theme,
    toWidth,
    zoomLevel,
    maxSide,
  });

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
    // A zoomed out image is smaller because it was asked to be, so what says
    // resolution was lost is the zoom that was asked for, not one image pixel
    // per scene unit.
    const asked = pixelRatio * scene.zoomLevel;

    let reduction: ResolutionReduction | null = null;

    if (drawn < asked) {
      // Worked out as the dialog works out its warning before the file exists,
      // so the message after it names the very pixels the dialog named.
      const { askedWidth, askedHeight } = getExportSize(
        scene.box,
        scene.zoomLevel,
        pixelRatio
      );
      reduction = { askedWidth, askedHeight, width, height };
    }

    return {
      blob,
      width,
      height,
      documentWidth: scene.box.width,
      documentHeight: scene.box.height,
      zoomLevel: scene.zoomLevel,
      reduction,
    };
  } finally {
    scene.destroy();
  }
}
