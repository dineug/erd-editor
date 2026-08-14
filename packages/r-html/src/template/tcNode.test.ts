import { describe, expect, it } from 'vitest';

import { cssParser } from '@/parser';
import { VCNode, VCNodeType } from '@/parser/vcNode';
import { createMarker } from '@/template/helper';
import { createTCNode, TCNode, TCProperty } from '@/template/tcNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

describe('template/tcNode', () => {
  describe('TCProperty', () => {
    it('copies name and value from the parsed property', () => {
      const property = new TCProperty({ name: 'color', value: 'red' });

      expect(property.name).toBe('color');
      expect(property.value).toBe('red');
      expect(property.isMarkerName).toBe(false);
      expect(property.isMarkerValue).toBe(false);
      expect(property.isDynamic).toBe(false);
    });

    it('detects a marker inside the name and inside the value', () => {
      const property = new TCProperty({
        name: `x-${m0}`,
        value: `${m1}px`,
      });

      expect(property.isMarkerName).toBe(true);
      expect(property.isMarkerValue).toBe(true);
      expect(property.isDynamic).toBe(false);
    });

    it('is dynamic only when name and value are the very same marker', () => {
      expect(new TCProperty({ name: m0, value: m0 }).isDynamic).toBe(true);
      expect(new TCProperty({ name: m0, value: m1 }).isDynamic).toBe(false);
      expect(
        new TCProperty({ name: `x-${m0}`, value: `x-${m0}` }).isDynamic
      ).toBe(false);
    });
  });

  describe('TCNode', () => {
    it('defaults to a comment node without parent', () => {
      const node = new TCNode(new VCNode());

      expect(node.type).toBe(VCNodeType.comment);
      expect(node.value).toBeUndefined();
      expect(node.parent).toBeNull();
      expect(node.properties).toBeUndefined();
      expect(node.children).toBeUndefined();
      expect(node.isMarker).toBe(false);
      expect(node.isThis).toBe(false);
      expect(node.isAtRule).toBe(false);
    });

    it('maps properties into TCProperty instances', () => {
      const node = new TCNode(
        new VCNode({
          type: VCNodeType.style,
          properties: [{ name: 'color', value: 'red' }],
        })
      );

      expect(node.properties).toHaveLength(1);
      expect(node.properties?.[0]).toBeInstanceOf(TCProperty);
      expect(node.properties?.[0].name).toBe('color');
    });

    it('maps children recursively and links them to their parent', () => {
      const node = new TCNode(
        new VCNode({
          type: VCNodeType.style,
          children: [
            new VCNode({
              type: VCNodeType.style,
              value: '.a',
              children: [new VCNode({ type: VCNodeType.style, value: '.b' })],
            }),
          ],
        })
      );

      const a = node.children?.[0] as TCNode;
      const b = a.children?.[0] as TCNode;

      expect(a).toBeInstanceOf(TCNode);
      expect(a.parent).toBe(node);
      expect(b.parent).toBe(a);
    });

    it('detects markers, nesting selectors and at rules', () => {
      const marker = new TCNode(
        new VCNode({ type: VCNodeType.style, value: `${m0} span` })
      );
      const nesting = new TCNode(
        new VCNode({ type: VCNodeType.style, value: '&:hover' })
      );
      const atRule = new TCNode(
        new VCNode({ type: VCNodeType.atRule, value: '@media screen' })
      );

      expect(marker.isMarker).toBe(true);
      expect(marker.isThis).toBe(false);
      expect(nesting.isThis).toBe(true);
      expect(nesting.isAtRule).toBe(false);
      expect(atRule.isAtRule).toBe(true);
    });

    it('iterates from a node up to the root through iterParent', () => {
      const root = new TCNode(
        new VCNode({
          type: VCNodeType.style,
          children: [
            new VCNode({
              type: VCNodeType.style,
              value: '.a',
              children: [new VCNode({ type: VCNodeType.style, value: '.b' })],
            }),
          ],
        })
      );
      const b = root.children?.[0].children?.[0] as TCNode;

      expect([...b.iterParent()].map(node => node.value)).toEqual([
        '.b',
        '.a',
        undefined,
      ]);
      expect([...root.iterParent()]).toEqual([root]);
    });

    it('iterates the whole subtree depth first', () => {
      const root = new TCNode(
        new VCNode({
          type: VCNodeType.style,
          children: [
            new VCNode({
              type: VCNodeType.style,
              value: '.a',
              children: [new VCNode({ type: VCNodeType.style, value: '.b' })],
            }),
            new VCNode({ type: VCNodeType.style, value: '.c' }),
          ],
        })
      );

      expect([...root].map(node => node.value)).toEqual([
        undefined,
        '.a',
        '.b',
        '.c',
      ]);
    });
  });

  describe('createTCNode', () => {
    it('builds a root node from a parsed css ast', () => {
      const node = createTCNode(
        cssParser(`
          color: red;
          .child {
            color: blue;
          }
          @media screen {
            color: green;
          }
        `)
      );

      expect(node).toBeInstanceOf(TCNode);
      expect(node.parent).toBeNull();
      expect(node.type).toBe(VCNodeType.style);
      expect(node.properties?.map(({ name, value }) => [name, value])).toEqual([
        ['color', 'red'],
      ]);
      expect(node.children?.map(child => child.value)).toEqual([
        '.child',
        '@media screen',
      ]);
      expect(node.children?.[1].isAtRule).toBe(true);
    });

    it('keeps dynamic properties produced by markers', () => {
      const node = createTCNode(cssParser(`${m0};`));

      expect(node.properties?.[0].isDynamic).toBe(true);
      expect(node.properties?.[0].name).toBe(m0);
    });
  });
});
