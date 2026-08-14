import { describe, expect, it } from 'vitest';

import { TAttrType } from '@/constants';
import { PropPart } from '@/render/part/node/component/prop';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const createProps = () => {
  const target: any = {};
  const setCalls: Array<[string, any]> = [];
  const props = new Proxy(target, {
    set(t, p, value, receiver) {
      setCalls.push([String(p), value]);
      return Reflect.set(t, p, value, receiver);
    },
  });
  return { props, target, setCalls };
};

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.property,
  name,
  value,
});

describe('PropPart', () => {
  it('writes the marker value onto the props object', () => {
    const { props, target } = createProps();
    const part = new PropPart(props, attr('value', createMarker(1)));

    part.commit(['zero', 'one']);

    expect(target.value).toBe('one');
  });

  it('uses the last marker when the value has several markers', () => {
    const { props, target } = createProps();
    const part = new PropPart(
      props,
      attr('value', `${createMarker(0)}-${createMarker(2)}`)
    );

    part.commit(['a', 'b', 'c']);

    expect(target.value).toBe('c');
  });

  it('does nothing when the attribute has no value', () => {
    const { props, target, setCalls } = createProps();
    const part = new PropPart(props, attr('value'));

    part.commit(['a']);

    expect(setCalls).toEqual([]);
    expect('value' in target).toBe(false);
  });

  it('does nothing when the attribute value holds no marker', () => {
    const { props, setCalls } = createProps();
    const part = new PropPart(props, attr('value', 'plain'));

    part.commit(['a']);

    expect(setCalls).toEqual([]);
  });

  it('skips the write when the marker values are unchanged', () => {
    const { props, setCalls } = createProps();
    const part = new PropPart(props, attr('value', createMarker(0)));

    part.commit(['same']);
    part.commit(['same']);

    expect(setCalls).toEqual([['value', 'same']]);
  });

  it('writes again once the marker value changes', () => {
    const { props, target, setCalls } = createProps();
    const part = new PropPart(props, attr('value', createMarker(0)));

    part.commit(['first']);
    part.commit(['second']);

    expect(target.value).toBe('second');
    expect(setCalls).toEqual([
      ['value', 'first'],
      ['value', 'second'],
    ]);
  });

  it('writes undefined when the marker index is out of range', () => {
    const { props, target, setCalls } = createProps();
    const part = new PropPart(props, attr('value', createMarker(5)));

    part.commit(['a']);
    part.commit(['a']);

    expect(target.value).toBeUndefined();
    expect('value' in target).toBe(true);
    expect(setCalls).toEqual([['value', undefined]]);
  });

  it('supports non primitive values', () => {
    const { props, target } = createProps();
    const part = new PropPart(props, attr('onClick', createMarker(0)));
    const handler = () => {};

    part.commit([handler]);

    expect(target.onClick).toBe(handler);
  });
});
