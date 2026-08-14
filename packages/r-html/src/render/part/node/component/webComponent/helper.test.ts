import { afterEach, describe, expect, it } from 'vitest';

import {
  closestElement,
  getDefaultProps,
  getPropNames,
  getPropTypes,
  queryShadowSelector,
  queryShadowSelectorAll,
} from '@/render/part/node/component/webComponent/helper';

const trash: Element[] = [];

const attach = <T extends Element>(el: T): T => {
  document.body.append(el);
  trash.push(el);
  return el;
};

const div = (html = '', className?: string) => {
  const el = document.createElement('div');
  if (className) el.className = className;
  el.innerHTML = html;
  return el;
};

const withShadow = (el: Element, html: string) => {
  const shadowRoot = el.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = html;
  return shadowRoot;
};

afterEach(() => {
  trash.splice(0).forEach(el => el.remove());
});

describe('getPropNames', () => {
  it('returns the array as-is', () => {
    const observedProps = ['a', 'bValue'];

    expect(getPropNames(observedProps)).toBe(observedProps);
  });

  it('returns an empty array when observedProps is undefined', () => {
    expect(getPropNames(undefined)).toEqual([]);
  });

  it('returns the keys of an object definition', () => {
    expect(getPropNames({ a: String, bValue: { type: Number } })).toEqual([
      'a',
      'bValue',
    ]);
  });
});

describe('getDefaultProps', () => {
  it('returns an empty array for undefined and array definitions', () => {
    expect(getDefaultProps(undefined)).toEqual([]);
    expect(getDefaultProps(['a', 'b'])).toEqual([]);
  });

  it('derives implicit defaults from the constructor shorthand', () => {
    expect(getDefaultProps({ n: Number, s: String, b: Boolean })).toEqual([
      ['n', 0],
      ['s', ''],
      ['b', false],
    ]);
  });

  it('uses the explicit default of an option object', () => {
    expect(
      getDefaultProps({
        n: { type: Number, default: 42 },
        s: { default: 'hi' },
        nil: { default: null },
      })
    ).toEqual([
      ['n', 42],
      ['s', 'hi'],
      ['nil', null],
    ]);
  });

  it('skips option objects without a default and bare convert functions', () => {
    const convert = (value: string | null) => `${value}!`;

    expect(
      getDefaultProps({
        typed: { type: Number },
        empty: {},
        undef: { default: undefined },
        convert,
      })
    ).toEqual([]);
  });
});

describe('getPropTypes', () => {
  it('returns an empty array for undefined and array definitions', () => {
    expect(getPropTypes(undefined)).toEqual([]);
    expect(getPropTypes(['a', 'b'])).toEqual([]);
  });

  it('keeps function shorthands as the converter', () => {
    const convert = (value: string | null) => `${value}!`;

    expect(getPropTypes({ n: Number, convert })).toEqual([
      ['n', Number],
      ['convert', convert],
    ]);
  });

  it('unwraps the type of an option object', () => {
    expect(getPropTypes({ b: { type: Boolean, default: true } })).toEqual([
      ['b', Boolean],
    ]);
  });

  it('skips option objects without a type', () => {
    expect(getPropTypes({ onlyDefault: { default: 1 }, empty: {} })).toEqual(
      []
    );
  });
});

describe('closestElement', () => {
  it('finds the closest ancestor inside the same tree', () => {
    const root = attach(div('<section><span id="t"></span></section>', 'root'));
    const target = root.querySelector('#t') as Element;

    expect(closestElement('.root', target)).toBe(root);
  });

  it('matches the element itself', () => {
    const root = attach(div('', 'root'));

    expect(closestElement('.root', root)).toBe(root);
  });

  it('walks out of a shadow root through its host', () => {
    const host = attach(div('', 'outer'));
    const shadowRoot = withShadow(host, '<span id="inner"></span>');
    const inner = shadowRoot.querySelector('#inner') as Element;

    expect(closestElement('.outer', inner)).toBe(host);
  });

  it('walks through nested shadow roots', () => {
    const host = attach(div('', 'outer'));
    const outerShadow = withShadow(host, '<div id="mid"></div>');
    const mid = outerShadow.querySelector('#mid') as Element;
    const midShadow = withShadow(mid, '<b id="leaf"></b>');
    const leaf = midShadow.querySelector('#leaf') as Element;

    expect(closestElement('.outer', leaf)).toBe(host);
  });

  it('returns null when nothing matches up to the document', () => {
    const root = attach(div('<span id="t"></span>'));
    const target = root.querySelector('#t') as Element;

    expect(closestElement('.nope', target)).toBeNull();
  });

  it('returns null for falsy, document and window roots', () => {
    expect(closestElement('.x', null)).toBeNull();
    expect(closestElement('.x', undefined)).toBeNull();
    expect(closestElement('.x', document, null)).toBeNull();
    expect(closestElement('.x', window, null)).toBeNull();
  });

  it('honours an explicitly provided target', () => {
    const root = attach(div('', 'root'));
    const other = attach(div('', 'other'));

    expect(closestElement('.root', root, other)).toBe(other);
  });
});

describe('queryShadowSelector', () => {
  it('returns null when no selector is given', () => {
    const root = attach(div('<span></span>'));

    expect(queryShadowSelector([], root)).toBeNull();
  });

  it('queries the light DOM first', () => {
    const root = attach(div('<span class="a">light</span>'));
    withShadow(root, '<span class="a">shadow</span>');

    expect(queryShadowSelector(['.a'], root)?.textContent).toBe('light');
  });

  it('falls back to the shadow root when the light DOM misses', () => {
    const root = attach(div());
    withShadow(root, '<span class="a">shadow</span>');

    expect(queryShadowSelector(['.a'], root)?.textContent).toBe('shadow');
  });

  it('walks a chain of selectors across shadow boundaries', () => {
    const root = attach(div());
    const shadowRoot = withShadow(root, '<section class="a"></section>');
    const section = shadowRoot.querySelector('.a') as Element;
    withShadow(section, '<b class="b">leaf</b>');

    expect(queryShadowSelector(['.a', '.b'], root)?.textContent).toBe('leaf');
  });

  it('returns undefined once a step of the chain misses', () => {
    const root = attach(div('<span class="a"></span>'));

    expect(queryShadowSelector(['.a', '.missing'], root)).toBeUndefined();
    expect(queryShadowSelector(['.missing'], root)).toBeUndefined();
  });
});

describe('queryShadowSelectorAll', () => {
  it('returns an empty array when no selector is given', () => {
    const root = attach(div('<span></span>'));

    expect(queryShadowSelectorAll([], root)).toEqual([]);
  });

  it('collects shadow matches before light matches', () => {
    const root = attach(div('<span class="a">light</span>'));
    withShadow(root, '<span class="a">shadow</span>');

    expect(
      queryShadowSelectorAll(['.a'], root).map(el => el.textContent)
    ).toEqual(['shadow', 'light']);
  });

  it('collects every match of the last selector across all branches', () => {
    const root = attach(div('<div class="a"><i class="b">1</i></div>'));
    const shadowRoot = withShadow(root, '<div class="a"></div>');
    const shadowA = shadowRoot.querySelector('.a') as Element;
    withShadow(shadowA, '<i class="b">2</i>');

    expect(
      queryShadowSelectorAll(['.a', '.b'], root).map(el => el.textContent)
    ).toEqual(['2', '1']);
  });

  it('returns an empty array when nothing matches', () => {
    const root = attach(div('<span></span>'));

    expect(queryShadowSelectorAll(['.missing'], root)).toEqual([]);
  });
});
