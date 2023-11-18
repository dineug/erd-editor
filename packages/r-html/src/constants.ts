export const PREFIX_ON_EVENT = 'on';
export const PREFIX_EVENT = '@';
export const PREFIX_PROPERTY = '.';
export const PREFIX_BOOLEAN = '?';
const PREFIX_SPREAD = '...';
const PREFIX_MARKER = '@@r-html';
const SUFFIX_MARKER = Math.random().toString().substring(2, 8);

export const MARKER = `${PREFIX_MARKER}-${SUFFIX_MARKER}`;
export const SPREAD_MARKER = `${PREFIX_SPREAD}${MARKER}`;

export const markersRegexp = new RegExp(`${MARKER}_(\\d+)_`, 'g');
export const markerOnlyRegexp = new RegExp(`^${MARKER}_\\d+_$`);
export const nextLineRegexp = /^\n/;

export enum TAttrType {
  attribute = 'attribute',
  boolean = 'boolean',
  event = 'event',
  property = 'property',
  spread = 'spread',
  directive = 'directive',
}

export const BEFORE_MOUNT = Symbol.for(
  'https://github.com/dineug/r-html#beforeMount'
);
export const MOUNTED = Symbol.for('https://github.com/dineug/r-html#mounted');
export const UNMOUNTED = Symbol.for(
  'https://github.com/dineug/r-html#unmounted'
);
export const BEFORE_FIRST_UPDATE = Symbol.for(
  'https://github.com/dineug/r-html#beforeFirstUpdate'
);
export const BEFORE_UPDATE = Symbol.for(
  'https://github.com/dineug/r-html#beforeUpdate'
);
export const FIRST_UPDATED = Symbol.for(
  'https://github.com/dineug/r-html#firstUpdated'
);
export const UPDATED = Symbol.for('https://github.com/dineug/r-html#updated');

export const LIFECYCLE_NAMES: LifecycleName[] = [
  BEFORE_MOUNT,
  MOUNTED,
  UNMOUNTED,
  BEFORE_FIRST_UPDATE,
  BEFORE_UPDATE,
  FIRST_UPDATED,
  UPDATED,
];

export type LifecycleName =
  | typeof BEFORE_MOUNT
  | typeof MOUNTED
  | typeof UNMOUNTED
  | typeof BEFORE_FIRST_UPDATE
  | typeof FIRST_UPDATED
  | typeof BEFORE_UPDATE
  | typeof UPDATED;

export const DIRECTIVE = Symbol.for(
  'https://github.com/dineug/r-html#Directive'
);
export const TEMPLATE_LITERALS = Symbol.for(
  'https://github.com/dineug/r-html#TemplateLiterals'
);
