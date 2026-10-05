import { toOpaqueHex } from '@/utils/tableColor';

/** A value the canvas cannot read leaves its fillStyle as it was, so a reading that differs over these two was no color. */
const GROUNDS = ['#000000', '#ffffff'];

/**
 * A CSS color as an opaque lower-case #rrggbb, any alpha dropped: the forms toOpaqueHex
 * reads, then any a canvas fillStyle reads, a name such as red or an oklch(); null for
 * an empty or unreadable one, or one in the canvas's own syntax that paints nothing.
 */
export function resolveColor(color: string): string | null {
  const value = color.trim();
  if (!value) return null;

  const hex = toOpaqueHex(value);
  if (hex) return hex;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;

  const readings = GROUNDS.map(ground => {
    context.fillStyle = ground;
    context.fillStyle = value;
    return String(context.fillStyle);
  });
  if (readings[0] !== readings[1]) return null;

  return toOpaqueHex(readings[0]) ?? paintedHex(context);
}

/**
 * The color a canvas writes back in its own syntax, an oklch() or a color(), as
 * the sRGB pixel it paints on its blank canvas; a translucent one may drift by
 * one in a channel, since the pixel is stored premultiplied.
 */
function paintedHex(context: CanvasRenderingContext2D): string | null {
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return a ? toOpaqueHex(`rgb(${r}, ${g}, ${b})`) : null;
}
