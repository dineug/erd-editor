import type { LocaleMessages } from '@/i18n/translate';
import type { Theme } from '@/themes/tokens';

import { renderDocumentScene } from './documentScene';
import { toSceneSvg } from './sceneSvg';
import type { ToWidth } from './textWidth';

/** Everything an svg needs that survives a structured clone to another realm. */
export type RenderSvgRequest = {
  doc: string;
  theme: Theme;
  /** The zoom to draw at; the document's own when the caller names none. */
  zoomLevel?: number;
  /** The language the scene's own words are drawn in; English when left out. */
  i18n?: LocaleMessages;
};

/**
 * The longest side of the Stage an svg is read off. Nothing rasterises that
 * Stage and the scene lays itself out at the zoom whatever its size, so a
 * small one spares the canvas a png of the same box would have needed.
 */
const STAGE_MAX_SIDE = 256;

/**
 * The whole document as an svg, at the zoom it is read at and with no scale,
 * since a vector has no pixels to multiply. It draws the scene the png draws,
 * in whichever realm calls it, and reads the svg off that scene's nodes.
 *
 * @example
 * const svg = await renderDocumentSvg({ doc, theme, zoomLevel, toWidth });
 */
export async function renderDocumentSvg({
  doc,
  theme,
  zoomLevel,
  i18n,
  toWidth,
}: RenderSvgRequest & { toWidth: ToWidth }): Promise<string> {
  const scene = await renderDocumentScene({
    doc,
    theme,
    toWidth,
    zoomLevel,
    maxSide: STAGE_MAX_SIDE,
    i18n,
  });

  try {
    return toSceneSvg(scene.stage, {
      box: scene.box,
      scale: scene.scale,
      zoomLevel: scene.zoomLevel,
    });
  } finally {
    scene.destroy();
  }
}
