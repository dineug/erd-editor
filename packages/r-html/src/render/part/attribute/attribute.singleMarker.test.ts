import { describe, expect, it } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { AttributePart } from '@/render/part/attribute/attribute';
import { safeToString } from '@/render/value';
import { css } from '@/template/css';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.attribute,
  name,
  value,
});

const legacyAttributeValue = (
  attrValue: string,
  markers: string[],
  values: any[]
) =>
  values
    .reduce<string>(
      (acc, cur, i) => acc.replace(new RegExp(markers[i]), safeToString(cur)),
      attrValue
    )
    .trim();

const commit = (attrValue: string, values: any[]) => {
  const el = document.createElement('div');
  const part = new AttributePart(el, attr('data-x', attrValue));
  part.commit(values);
  return el.getAttribute('data-x');
};

const cssValue = css`
  color: red;
`;

const valueTable: Array<[string, any, string]> = [
  ['a string', 'foo', 'foo'],
  ['an empty string', '', ''],
  ['a padded string', '  foo  ', 'foo'],
  ['a number', 42, '42'],
  ['the number zero', 0, '0'],
  ['a bigint', 10n, '10'],
  ['true', true, 'true'],
  ['false', false, 'false'],
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['an object', { a: 1 }, ''],
  ['an array', [1, 2], ''],
  ['a function', () => {}, ''],
  ['a css template literal', cssValue, String(cssValue)],
];

const markerSpellings: Array<[string, string]> = [
  ['without surrounding whitespace', m0],
  ['with surrounding whitespace', ` ${m0} `],
];

describe('AttributePart single-marker fast path', () => {
  describe.each(markerSpellings)('%s', (_, attrValue) => {
    it.each(valueTable)(
      'writes %s the same way the old string pipeline did',
      (_label, value, expected) => {
        expect(commit(attrValue, [value])).toBe(expected);
        expect(commit(attrValue, [value])).toBe(
          legacyAttributeValue(attrValue, [m0], [value])
        );
      }
    );
  });

  it('takes the fast path only when the value is the whole attribute', () => {
    expect(commit(`a-${m0}`, ['$&'])).toBe(`a-${m0}`);
    expect(commit(`a-${m0}`, ['$&'])).toBe(
      legacyAttributeValue(`a-${m0}`, [m0], ['$&'])
    );
  });
});

describe('AttributePart single-marker $ patterns (changed behaviour)', () => {
  it('inserts $& literally, where the old pipeline inserted the matched marker', () => {
    expect(commit(m0, ['$&'])).toBe('$&');
    expect(legacyAttributeValue(m0, [m0], ['$&'])).toBe(m0);
  });

  it('inserts $` literally, where the old pipeline inserted the text before the marker', () => {
    expect(commit(m0, ['$`'])).toBe('$`');
    expect(legacyAttributeValue(m0, [m0], ['$`'])).toBe('');
  });

  it("inserts $' literally, where the old pipeline inserted the text after the marker", () => {
    expect(commit(m0, ["$'"])).toBe("$'");
    expect(legacyAttributeValue(m0, [m0], ["$'"])).toBe('');
  });

  it('inserts $1 literally, which is the one pattern the old pipeline also left alone', () => {
    expect(commit(m0, ['$1'])).toBe('$1');
    expect(legacyAttributeValue(m0, [m0], ['$1'])).toBe('$1');
  });

  it('inserts $$ literally, where the old pipeline collapsed it to a single $', () => {
    expect(commit(m0, ['$$'])).toBe('$$');
    expect(legacyAttributeValue(m0, [m0], ['$$'])).toBe('$');
  });

  it('inserts the pattern literally whatever whitespace surrounds the marker', () => {
    expect(commit(` ${m0} `, ['$&'])).toBe('$&');
    expect(commit(` ${m0} `, ['$$'])).toBe('$$');
  });
});

describe('AttributePart multi-marker $ patterns (unchanged behaviour)', () => {
  it('still reads $& as the matched marker text', () => {
    expect(commit(`a-${m0}-${m1}`, ['$&', 'y'])).toBe(`a-${m0}-y`);
    expect(commit(`a-${m0}-${m1}`, ['$&', 'y'])).toBe(
      legacyAttributeValue(`a-${m0}-${m1}`, [m0, m1], ['$&', 'y'])
    );
  });

  it('still collapses $$ to a single $', () => {
    expect(commit(`${m0}-${m1}`, ['$$', 'y'])).toBe('$-y');
    expect(commit(`${m0}-${m1}`, ['$$', 'y'])).toBe(
      legacyAttributeValue(`${m0}-${m1}`, [m0, m1], ['$$', 'y'])
    );
  });
});
