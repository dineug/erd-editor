import { describe, expect, it } from 'vite-plus/test';

import {
  BEFORE_FIRST_UPDATE,
  BEFORE_MOUNT,
  BEFORE_UPDATE,
  DIRECTIVE,
  FIRST_UPDATED,
  LIFECYCLE_NAMES,
  MARKER,
  markerOnlyRegexp,
  markersRegexp,
  MOUNTED,
  nextLineRegexp,
  PREFIX_BOOLEAN,
  PREFIX_EVENT,
  PREFIX_ON_EVENT,
  PREFIX_PROPERTY,
  SPREAD_MARKER,
  TAttrType,
  TEMPLATE_LITERALS,
  UNMOUNTED,
  UPDATED,
} from '@/constants';

describe('prefixes', () => {
  it('exposes the binding prefixes used by the template parser', () => {
    expect(PREFIX_ON_EVENT).toBe('on');
    expect(PREFIX_EVENT).toBe('@');
    expect(PREFIX_PROPERTY).toBe('.');
    expect(PREFIX_BOOLEAN).toBe('?');
  });
});

describe('MARKER', () => {
  it('is prefixed with the r-html namespace and a random suffix', () => {
    expect(MARKER.startsWith('@@r-html-')).toBe(true);
    expect(MARKER.length).toBeGreaterThan('@@r-html-'.length);
  });

  it('builds the spread marker from the marker', () => {
    expect(SPREAD_MARKER).toBe(`...${MARKER}`);
  });
});

describe('markersRegexp', () => {
  it('is global so it can find every marker in a template', () => {
    expect(markersRegexp.global).toBe(true);
  });

  it('captures the index of each marker', () => {
    const source = `a ${MARKER}_0_ b ${MARKER}_12_ c`;
    const found = [...source.matchAll(markersRegexp)].map(match => match[1]);

    expect(found).toEqual(['0', '12']);
  });

  it('replaces markers by their captured index', () => {
    const source = `<div>${MARKER}_3_</div>`;

    expect(source.replace(markersRegexp, (_, index) => `#${index}`)).toBe(
      '<div>#3</div>'
    );
  });

  it('does not match a marker without an index', () => {
    expect(`${MARKER}`.replace(markersRegexp, 'x')).toBe(MARKER);
  });
});

describe('markerOnlyRegexp', () => {
  it('matches a string that is exactly one marker', () => {
    expect(markerOnlyRegexp.test(`${MARKER}_0_`)).toBe(true);
    expect(markerOnlyRegexp.test(`${MARKER}_100_`)).toBe(true);
  });

  it('rejects markers surrounded by other content', () => {
    expect(markerOnlyRegexp.test(` ${MARKER}_0_`)).toBe(false);
    expect(markerOnlyRegexp.test(`${MARKER}_0_ `)).toBe(false);
    expect(markerOnlyRegexp.test(`${MARKER}_0_${MARKER}_1_`)).toBe(false);
    expect(markerOnlyRegexp.test('')).toBe(false);
  });
});

describe('nextLineRegexp', () => {
  it('matches only a leading newline', () => {
    expect(nextLineRegexp.test('\nvalue')).toBe(true);
    expect(nextLineRegexp.test('value\n')).toBe(false);
    expect(nextLineRegexp.test(' \nvalue')).toBe(false);
  });
});

describe('TAttrType', () => {
  it('maps each attribute kind to its own name', () => {
    expect(TAttrType.attribute).toBe('attribute');
    expect(TAttrType.boolean).toBe('boolean');
    expect(TAttrType.event).toBe('event');
    expect(TAttrType.property).toBe('property');
    expect(TAttrType.spread).toBe('spread');
    expect(TAttrType.directive).toBe('directive');
  });
});

describe('lifecycle symbols', () => {
  it('uses the global symbol registry so duplicated bundles interoperate', () => {
    expect(BEFORE_MOUNT).toBe(
      Symbol.for('https://github.com/dineug/r-html#beforeMount')
    );
    expect(MOUNTED).toBe(
      Symbol.for('https://github.com/dineug/r-html#mounted')
    );
    expect(UNMOUNTED).toBe(
      Symbol.for('https://github.com/dineug/r-html#unmounted')
    );
    expect(BEFORE_FIRST_UPDATE).toBe(
      Symbol.for('https://github.com/dineug/r-html#beforeFirstUpdate')
    );
    expect(BEFORE_UPDATE).toBe(
      Symbol.for('https://github.com/dineug/r-html#beforeUpdate')
    );
    expect(FIRST_UPDATED).toBe(
      Symbol.for('https://github.com/dineug/r-html#firstUpdated')
    );
    expect(UPDATED).toBe(
      Symbol.for('https://github.com/dineug/r-html#updated')
    );
    expect(DIRECTIVE).toBe(
      Symbol.for('https://github.com/dineug/r-html#Directive')
    );
    expect(TEMPLATE_LITERALS).toBe(
      Symbol.for('https://github.com/dineug/r-html#TemplateLiterals')
    );
  });

  it('lists every lifecycle name exactly once', () => {
    expect(LIFECYCLE_NAMES).toEqual([
      BEFORE_MOUNT,
      MOUNTED,
      UNMOUNTED,
      BEFORE_FIRST_UPDATE,
      BEFORE_UPDATE,
      FIRST_UPDATED,
      UPDATED,
    ]);
    expect(new Set(LIFECYCLE_NAMES).size).toBe(LIFECYCLE_NAMES.length);
  });
});
