import { toLinear, toOpaqueHex } from '@/utils/tableColor';

/** The dark text a light background takes. */
export const CONTRAST_BLACK = '#000000';

/** The light text a dark background takes. */
export const CONTRAST_WHITE = '#ffffff';

/**
 * A color's WCAG 2 relative luminance, from 0 for black to 1 for white, any
 * alpha dropped; null for a color toOpaqueHex cannot read.
 */
export function relativeLuminance(color: string): number | null {
  const hex = toOpaqueHex(color);
  if (!hex) return null;

  const [r, g, b] = [1, 3, 5].map(offset =>
    toLinear(parseInt(hex.slice(offset, offset + 2), 16))
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio of two relative luminances, from 1 to 21 in either order. */
export function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** How far black's contrast ratio must lead white's before black text is picked. */
const BLACK_MIN_LEAD = 4;

/**
 * White, unless black's WCAG 2 contrast ratio against the background beats
 * white's by more than 4, so white is never under 3 and black never under 7.
 * Null for a background toOpaqueHex cannot read, which keeps its colors.
 *
 * @example
 * contrastTextColor('#3b82f6'); // '#ffffff'
 */
export function contrastTextColor(background: string): string | null {
  const luminance = relativeLuminance(background);
  if (luminance === null) return null;

  const white = contrastRatio(luminance, 1);
  const black = contrastRatio(luminance, 0);

  return black - white > BLACK_MIN_LEAD ? CONTRAST_BLACK : CONTRAST_WHITE;
}
