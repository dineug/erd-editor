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

/**
 * Black or white, whichever has the higher WCAG 2 contrast ratio against the
 * background, black on a tie, so the one picked is never under 4.58. Null for
 * a background toOpaqueHex cannot read, which keeps the colors it had.
 *
 * @example
 * contrastTextColor('#3b82f6'); // '#000000'
 */
export function contrastTextColor(background: string): string | null {
  const luminance = relativeLuminance(background);
  if (luminance === null) return null;

  return contrastRatio(luminance, 0) >= contrastRatio(luminance, 1)
    ? CONTRAST_BLACK
    : CONTRAST_WHITE;
}
