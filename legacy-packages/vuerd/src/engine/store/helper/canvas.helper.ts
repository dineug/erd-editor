import { createBalanceRange, isString } from '@/core/helper';
import {
  SIZE_CANVAS_MAX,
  SIZE_CANVAS_MIN,
  SIZE_CANVAS_ZOOM_MAX,
  SIZE_CANVAS_ZOOM_MIN,
} from '@/core/layout';

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

export const zoomLevelRange = (zoomLevel: number | string) =>
  zoomBalanceRange(
    (isString(zoomLevel)
      ? Number((zoomLevel as string).replace(/[^0-9]/g, ''))
      : zoomLevel) as number
  );

export const zoomDisplayFormat = (zoomLevel: number) =>
  `${(zoomLevel * 100).toFixed()}%`;
