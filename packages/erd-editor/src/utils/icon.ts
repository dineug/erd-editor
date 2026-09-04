import type { IconNode } from 'lucide';

import {
  getIcon,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
  type IconNodeChild,
  type NotationIconName,
} from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';

// 1, 32 and 64 are the RelationshipType members left commented out in
// @dineug/erd-editor-schema; they have no constant, so the bits are spelled out.
const relationshipTypeToIconName: Record<number, NotationIconName> = {
  [1]: 'ZeroOneN',
  [RelationshipType.ZeroOne]: 'ZeroOne',
  [RelationshipType.ZeroN]: 'ZeroN',
  [RelationshipType.OneOnly]: 'OneOnly',
  [RelationshipType.OneN]: 'OneN',
  [32]: 'One',
  [64]: 'N',
};

/** The box the cursor is rasterized into; Erd.tsx names its centre as the hotspot. */
const CURSOR_SIZE = 32;

/**
 * Ink over a halo twice its width, the way a system pointer stays legible on
 * any ground. A cursor image is a document of its own where no theme reaches,
 * so the appearance comes in as an argument and picks which is black.
 */
const CURSOR_HALO_WIDTH = ICON_STROKE_WIDTH * 2;

const BLACK = '#000';
const WHITE = '#fff';

const escapeAttribute = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

const element = ([tag, attrs]: IconNodeChild) => {
  const attributes = Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value!)}"`)
    .join('');

  return `<${tag}${attributes}/>`;
};

const layer = (children: string, stroke: string, strokeWidth: number) =>
  `<g stroke="${stroke}" stroke-width="${strokeWidth}">${children}</g>`;

/**
 * An icon node as an svg data uri, which is what css cursor takes. The glyph
 * is drawn twice, the halo under the ink, with the caps and joins Icon.tsx puts
 * on its svg so the cursor matches the menu item.
 */
export function toCursorImage(node: IconNode, isDarkMode: boolean): string {
  const ink = isDarkMode ? WHITE : BLACK;
  const halo = isDarkMode ? BLACK : WHITE;
  const children = node.map(element).join('');
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="${ICON_VIEW_BOX}"` +
    ` fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    layer(children, halo, CURSOR_HALO_WIDTH) +
    layer(children, ink, ICON_STROKE_WIDTH) +
    '</svg>';

  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

/** The draw-relationship cursor for a relationship type, or null for a type with no glyph. */
export function getRelationshipIcon(
  relationshipType: number,
  isDarkMode: boolean
): string | null {
  const icon = getIcon(relationshipTypeToIconName[relationshipType]);
  if (!icon) return null;

  return toCursorImage(icon.node, isDarkMode);
}
