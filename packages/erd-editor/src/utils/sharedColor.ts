import { get } from 'es-toolkit/compat';

import { Palette } from '@/themes/radix-ui-theme';

const SharedColorHues = [
  'tomato',
  'gold',
  'grass',
  'teal',
  'iris',
  'purple',
  'plum',
  'pink',
] as const;

export const SharedColors: ReadonlyArray<string> = SharedColorHues.map(
  hue => get(Palette, `${hue}.${hue}9`) ?? ''
);

export function toSharedColor(id: string): string {
  let hash = 0;

  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }

  return SharedColors[Math.abs(hash) % SharedColors.length];
}
