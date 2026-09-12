const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function channelsOf(color: string): number[] | null {
  const match = HEX.exec(color.trim());
  if (!match) return null;

  const hex = match[1];
  const wide = hex.length === 6;

  return [0, 1, 2].map(index =>
    wide
      ? parseInt(hex.slice(index * 2, index * 2 + 2), 16)
      : parseInt(`${hex[index]}${hex[index]}`, 16)
  );
}

/**
 * The colour a fraction of the way from one to the other, mixed straight in
 * rgb. Both ends come back exactly as they were given, and a colour this
 * cannot read is handed back whole rather than mangled into one that is not.
 */
export function mixColor(from: string, to: string, t: number): string {
  if (!(t > 0)) return from;
  if (t >= 1) return to;

  const start = channelsOf(from);
  const end = channelsOf(to);
  if (!start || !end) return t < 0.5 ? from : to;

  const mixed = start.map((value, index) =>
    Math.round(value + (end[index] - value) * t)
  );

  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
