import { createInRange, isString } from '@dineug/shared';

import { MAX_CANVAS, MIN_CANVAS } from '@/constants/layout';

const NOT_NUM = /[^0-9]/g;

const toNumString = (value: string) => value.replace(NOT_NUM, '');

const canvasInRange = createInRange(MIN_CANVAS, MAX_CANVAS);

export function canvasSizeInRange(size: number | string) {
  const value = isString(size) ? Number(toNumString(size)) : size;
  return canvasInRange(value);
}

export function onNumberOnly(event: InputEvent) {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  input.value = toNumString(input.value);
}
