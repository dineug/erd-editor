type Channels = [number, number, number];
type Lab = [number, number, number];

/** The colors AML names, each the 500 shade of its Tailwind palette, in AML's order. */
export const AML_COLORS: Readonly<Record<string, string>> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  gray: '#6b7280',
};

const DBML_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const AML_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ANY_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FUNCTION = /^(rgba?|hsla?)\(([^()]*)\)$/i;
const ARGUMENT_SEPARATOR = /\s*[,/]\s*|\s+/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const ANGLE_UNIT = /deg$/i;
const PERCENT = /%$/;
const AML_COLOR_BY_NAME = new Map(Object.entries(AML_COLORS));

/** The OKLab chroma under which a color reads as gray, however light or dark. */
const GRAY_CHROMA = 0.04;

/** A DBML headercolor kept as written when it is #rgb or #rrggbb, else ''. */
export function fromDBMLColor(value: string): string {
  return DBML_HEX.test(value) ? value : '';
}

/**
 * One of AML's color names, in any letter case, as its hex; a #rgb, #rrggbb
 * or #rrggbbaa as written; else ''.
 */
export function fromAMLColor(value: string): string {
  return (
    AML_COLOR_BY_NAME.get(value.toLowerCase()) ??
    (AML_HEX.test(value) ? value : '')
  );
}

/**
 * A table color as DBML's headercolor writes it, which takes #rgb or #rrggbb
 * alone: a hex keeps its digits less any alpha, and an rgb() or hsl() becomes
 * its hex. A color that reads as neither is null.
 */
export function toDBMLColor(color: string): string | null {
  const value = color.trim();

  if (ANY_HEX.test(value)) {
    const digits = value.length - 1;
    return digits === 4 ? value.slice(0, 4) : value.slice(0, 7);
  }

  const channels = channelsOf(value);
  return channels ? toHex(channels) : null;
}

/**
 * The AML name of a table color: gray under the gray chroma and only there,
 * else the nearest other name in OKLab, the first in AML's order on a tie, so
 * a named hex finds its own name; null when it reads as no color.
 */
export function toAMLColor(color: string): string | null {
  const channels = channelsOf(color.trim());
  if (!channels) return null;

  const lab = oklabOf(channels);
  if (Math.hypot(lab[1], lab[2]) < GRAY_CHROMA) return 'gray';

  let nearest: string | null = null;
  let nearestDistance = Infinity;

  for (const [name, hex] of AML_COLOR_BY_NAME) {
    if (name === 'gray') continue;

    const named = oklabOf(channelsOf(hex) as Channels);
    const distance = named.reduce(
      (sum, value, index) => sum + (value - lab[index]) ** 2,
      0
    );

    if (distance < nearestDistance) {
      nearest = name;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function channelsOf(value: string): Channels | null {
  if (ANY_HEX.test(value)) {
    return hexChannels(value.slice(1));
  }

  const match = COLOR_FUNCTION.exec(value);
  if (!match) return null;

  const args = match[2].trim().split(ARGUMENT_SEPARATOR);
  if (args.length < 3) return null;

  return match[1].toLowerCase().startsWith('rgb')
    ? rgbChannels(args)
    : hslChannels(args);
}

function hexChannels(digits: string): Channels {
  const full =
    digits.length <= 4
      ? [...digits].map(digit => `${digit}${digit}`).join('')
      : digits;

  return [0, 2, 4].map(offset =>
    parseInt(full.slice(offset, offset + 2), 16)
  ) as Channels;
}

function rgbChannels(args: string[]): Channels | null {
  const channels: number[] = [];

  for (const arg of args.slice(0, 3)) {
    const percent = arg.endsWith('%');
    const value = numberOf(percent ? arg.slice(0, -1) : arg);
    if (value === null) return null;

    channels.push(clampChannel(percent ? value * 2.55 : value));
  }

  return channels as Channels;
}

/** The sRGB channels of an hsl() color, after CSS Color 4's hslToRgb. */
function hslChannels(args: string[]): Channels | null {
  const hue = numberOf(args[0].replace(ANGLE_UNIT, ''));
  const saturation = numberOf(args[1].replace(PERCENT, ''));
  const lightness = numberOf(args[2].replace(PERCENT, ''));
  if (hue === null || saturation === null || lightness === null) return null;

  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(Math.max(saturation, 0), 100) / 100;
  const l = Math.min(Math.max(lightness, 0), 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };

  return [f(0), f(8), f(4)].map(value => clampChannel(value * 255)) as Channels;
}

/** A color's OKLab lightness, a and b, by Ottosson's sRGB to OKLab matrices. */
function oklabOf(channels: Channels): Lab {
  const [r, g, b] = channels.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** An sRGB channel of 0 to 255 as linear light of 0 to 1. */
function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function numberOf(text: string): number | null {
  return NUMBER.test(text) ? Number(text) : null;
}

function clampChannel(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 255));
}

function toHex(channels: Channels): string {
  return `#${channels
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`;
}
