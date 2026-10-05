import { clamp } from 'es-toolkit';

import { toOpaqueHex } from '@/utils/tableColor';

/** Hue in degrees 0 to 360, saturation and value 0 to 1, kept unrounded. */
export type Hsv = { h: number; s: number; v: number };

export type Rgb = [number, number, number];

/** The step a key held with Shift takes, in percent or degrees. */
const COARSE_STEP = 10;

/** The step Page Up and Page Down take, in percent or degrees. */
const PAGE_STEP = 10;

const HEX_DIGITS = /^[0-9a-f]+$/i;
const COMPLETE_HEX = /^#?(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CHANNEL_DIGITS = /^\d{1,3}$/;

/** The channels of a color, rounded to whole 0 to 255 values; a hue of 360 is red again. */
export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return [f(5), f(3), f(1)];
}

/**
 * A color's hue, saturation and value, kept from the one before where the
 * channels hold none: a gray keeps the hue it had, and black keeps both.
 */
export function rgbToHsv([r, g, b]: Rgb, previous: Hsv): Hsv {
  const max = Math.max(r, g, b);
  const c = max - Math.min(r, g, b);
  const s = max === 0 ? previous.s : c / max;
  let h = previous.h;

  if (c !== 0) {
    if (max === r) h = 60 * (((g - b) / c) % 6);
    else if (max === g) h = 60 * ((b - r) / c + 2);
    else h = 60 * ((r - g) / c + 4);
    h = ((h % 360) + 360) % 360;
  }

  return { h, s, v: max / 255 };
}

/** A color as the lower-case #rrggbb it is handed on as. */
export function hsvToHex(hsv: Hsv): string {
  return `#${hsvToRgb(hsv)
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** A #rrggbb as hue, saturation and value, keeping what it lacks from the one before. */
export function hexToHsv(hex: string, previous: Hsv): Hsv {
  const rgb = [1, 3, 5].map(offset =>
    parseInt(hex.slice(offset, offset + 2), 16)
  ) as Rgb;
  return rgbToHsv(rgb, previous);
}

/**
 * What the Hex field reads as a color: digits with or without the mark, 3, 4,
 * 6 or 8 of them, or a pasted rgb() or hsl(), any alpha dropped; else null.
 */
export function parseHexInput(text: string): string | null {
  const value = text.trim();
  return toOpaqueHex(HEX_DIGITS.test(value) ? `#${value}` : value);
}

/** Whether the Hex field holds a whole color already, which it applies while typed. */
export function isCompleteHexInput(text: string): boolean {
  return COMPLETE_HEX.test(text.trim());
}

/** A channel field's whole number, 255 at most; null for anything else. */
export function parseChannelInput(text: string): number | null {
  const value = text.trim();
  return CHANNEL_DIGITS.test(value) ? Math.min(Number(value), 255) : null;
}

const toUnit = (percent: number) => clamp(percent, 0, 100) / 100;

/**
 * Where a key moves the saturation and brightness area, from the whole
 * percent nearest: left and right move saturation, the rest brightness, Home
 * and End take saturation to either end; null for a key it does not take.
 */
export function stepArea(hsv: Hsv, key: string, coarse: boolean): Hsv | null {
  const step = coarse ? COARSE_STEP : 1;
  const s = Math.round(hsv.s * 100);
  const v = Math.round(hsv.v * 100);

  switch (key) {
    case 'ArrowLeft':
      return { ...hsv, s: toUnit(s - step) };
    case 'ArrowRight':
      return { ...hsv, s: toUnit(s + step) };
    case 'ArrowDown':
      return { ...hsv, v: toUnit(v - step) };
    case 'ArrowUp':
      return { ...hsv, v: toUnit(v + step) };
    case 'PageDown':
      return { ...hsv, v: toUnit(v - PAGE_STEP) };
    case 'PageUp':
      return { ...hsv, v: toUnit(v + PAGE_STEP) };
    case 'Home':
      return { ...hsv, s: 0 };
    case 'End':
      return { ...hsv, s: 1 };
    default:
      return null;
  }
}

/** Where a key moves the hue, from the whole degree nearest, held to 0 to 360; null for a key it does not take. */
export function stepHue(
  h: number,
  key: string,
  coarse: boolean
): number | null {
  const step = coarse ? COARSE_STEP : 1;
  const degrees = Math.round(h);
  const hold = (value: number) => clamp(value, 0, 360);

  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return hold(degrees - step);
    case 'ArrowRight':
    case 'ArrowUp':
      return hold(degrees + step);
    case 'PageDown':
      return hold(degrees - PAGE_STEP);
    case 'PageUp':
      return hold(degrees + PAGE_STEP);
    case 'Home':
      return 0;
    case 'End':
      return 360;
    default:
      return null;
  }
}
