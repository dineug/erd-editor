import {
  MARKER,
  markerOnlyRegexp,
  markersRegexp,
  PREFIX_BOOLEAN,
  PREFIX_EVENT,
  PREFIX_ON_EVENT,
  PREFIX_PROPERTY,
  SPREAD_MARKER,
  TAttrType,
  TEMPLATE_LITERALS,
} from '@/constants';
import { isArray, isObject } from '@/helpers/is-type';
import {
  CSSTemplateLiterals,
  TemplateLiterals,
  TemplateLiteralsType,
  TemplateLiteralsTypes,
} from '@/template';
import { TAttr } from '@/template/tNode';

export type MarkerTuple = [string, number];

const svgTypes = new Set([TemplateLiteralsType.svg]);

export const createMarker = (index: number) => `${MARKER}_${index}_`;

export const isTemplateStringsArray = (
  value: any
): value is TemplateStringsArray =>
  isArray(value) && isArray((value as any).raw);

export const isTemplateLiterals = (value: any): value is TemplateLiterals =>
  isObject(value) &&
  isTemplateStringsArray(value.strings) &&
  isArray(value.values) &&
  TemplateLiteralsTypes.has(Reflect.get(value, TEMPLATE_LITERALS) ?? '');

export const isCSSTemplateLiterals = (
  value: any
): value is CSSTemplateLiterals =>
  isTemplateLiterals(value) &&
  value[TEMPLATE_LITERALS] === TemplateLiteralsType.css;

const createIsMarker =
  (marker: string, prefix = true, suffix = false) =>
  (value?: string | null): value is string => {
    if (prefix) return Boolean(value?.trimStart().startsWith(marker));
    if (suffix) return Boolean(value?.trimEnd().endsWith(marker));
    const regexp = new RegExp(marker);
    return regexp.test(value ?? '');
  };

export const isPrefixSpreadMarker = createIsMarker(SPREAD_MARKER);
export const isPrefixPropertyMarker = createIsMarker(PREFIX_PROPERTY);
export const isPrefixBooleanMarker = createIsMarker(PREFIX_BOOLEAN);
export const isPrefixEventMarker = createIsMarker(PREFIX_EVENT);
export const isPrefixOnEventMarker = createIsMarker(PREFIX_ON_EVENT);
export const isMarker = createIsMarker(MARKER, false);
export const isMarkerOnly = (value?: string | null) =>
  isMarker(value) && markerOnlyRegexp.test(value?.trim() ?? '');
export const isPartAttr = ({ type, value }: TAttr) =>
  type === TAttrType.spread || type === TAttrType.directive || isMarker(value);
export const isSVG = (type: TemplateLiteralsType) => svgTypes.has(type);

export const getAttrType = (value: string): TAttrType =>
  isMarkerOnly(value)
    ? TAttrType.directive
    : isPrefixSpreadMarker(value)
    ? TAttrType.spread
    : isPrefixPropertyMarker(value)
    ? TAttrType.property
    : isPrefixEventMarker(value) || isPrefixOnEventMarker(value)
    ? TAttrType.event
    : isPrefixBooleanMarker(value)
    ? TAttrType.boolean
    : TAttrType.attribute;

export const getAttrName = (value: string) =>
  isPrefixSpreadMarker(value)
    ? value.substring(3)
    : isMarkerOnly(value)
    ? value
    : isPrefixPropertyMarker(value) ||
      isPrefixEventMarker(value) ||
      isPrefixBooleanMarker(value)
    ? (value as string).substring(1)
    : isPrefixOnEventMarker(value)
    ? (value as string).substring(2)
    : value;

export function getMarkers(value: string): MarkerTuple[] {
  const markers: MarkerTuple[] = [];
  let match = markersRegexp.exec(value);

  while (match) {
    const index = Number(match[1]);
    markers.push([match[0], Number.isInteger(index) ? index : -1]);
    match = markersRegexp.exec(value);
  }

  return markers;
}

const characters = '0123456789abcdefghijklmnopqrstuvwxyz-_';

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

export function generateClassSelectorName(size = 21): string {
  let value = '_';

  for (let i = 0; i < size; i++) {
    value += characters.charAt(getRandomInt(0, characters.length));
  }

  return value;
}
