import { arrayHas, createInRange, isString } from '@dineug/shared';
import { round } from 'lodash-es';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import {
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  ColumnTypeList,
  DatabaseList,
  LanguageList,
  NameCaseList,
} from '@/constants/schema';

const NOT_NUM = /[^0-9]/g;

export const toNumString = (value: string) => value.replace(NOT_NUM, '');

const canvasInRange = createInRange(CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);

const zoomInRange = createInRange(CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX);

export function canvasSizeInRange(size: number | string) {
  const value = isString(size) ? Number(toNumString(size)) : size;
  return canvasInRange(value);
}

export function zoomLevelInRange(zoom: number) {
  return round(zoomInRange(zoom), 2);
}

export function toZoomFormat(zoomLevel: number) {
  return `${(zoomLevel * 100).toFixed()}%`;
}

export const hasDatabase = arrayHas(DatabaseList);
export const hasNameCase = arrayHas(NameCaseList);
export const hasBracketType = arrayHas(BracketTypeList);
export const hasLanguage = arrayHas(LanguageList);
export const hasColumnType = arrayHas(ColumnTypeList);

export function textInRange(width: number) {
  return Math.max(width, COLUMN_MIN_WIDTH);
}
