import { SIZE_CANVAS_MIN, SIZE_CANVAS_MAX } from '@/core/layout';
import { isString } from '@/core/helper';

export function canvasSizeRange(size: number | string): number {
  let resize = isString(size)
    ? Number((size as string).replace(/[^0-9]/g, ''))
    : size;

  if (resize < SIZE_CANVAS_MIN) {
    resize = SIZE_CANVAS_MIN;
  } else if (resize > SIZE_CANVAS_MAX) {
    resize = SIZE_CANVAS_MAX;
  }

  return resize as number;
}
