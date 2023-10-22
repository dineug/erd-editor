import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { arrayHas, createInRange, isString } from '@dineug/shared';
import { round } from 'lodash-es';

const NOT_NUM = /[^0-9]/g;

export const toNumString = (value: string) => value.replace(NOT_NUM, '');

const canvasInRange = createInRange(
  SchemaV3Constants.CANVAS_SIZE_MIN,
  SchemaV3Constants.CANVAS_SIZE_MAX
);

const zoomInRange = createInRange(
  SchemaV3Constants.CANVAS_ZOOM_MIN,
  SchemaV3Constants.CANVAS_ZOOM_MAX
);

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

export const hasDatabase = arrayHas(SchemaV3Constants.DatabaseList);
export const hasNameCase = arrayHas(SchemaV3Constants.NameCaseList);
export const hasBracketType = arrayHas(SchemaV3Constants.BracketTypeList);
export const hasLanguage = arrayHas(SchemaV3Constants.LanguageList);
export const hasColumnType = arrayHas(SchemaV3Constants.ColumnTypeList);
