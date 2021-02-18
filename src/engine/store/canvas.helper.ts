import {
  SIZE_CANVAS_MIN,
  SIZE_CANVAS_MAX,
  SIZE_CANVAS_ZOOM_MIN,
  SIZE_CANVAS_ZOOM_MAX,
} from '@/core/layout';
import { isString, createBalanceRange } from '@/core/helper';

export const canvasSizeBalanceRange = createBalanceRange(
  SIZE_CANVAS_MIN,
  SIZE_CANVAS_MAX
);

export const zoomBalanceRange = createBalanceRange(
  SIZE_CANVAS_ZOOM_MIN,
  SIZE_CANVAS_ZOOM_MAX
);

export const canvasSizeRange = (size: number | string) =>
  canvasSizeBalanceRange(
    (isString(size)
      ? Number((size as string).replace(/[^0-9]/g, ''))
      : size) as number
  );
