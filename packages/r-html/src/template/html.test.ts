import { describe, expect, it } from 'vite-plus/test';

import { TAttrType, TEMPLATE_LITERALS } from '@/constants';
import { VNodeType } from '@/parser/vNode';
import { templateCache, TemplateLiteralsType } from '@/template';
import { createMarker } from '@/template/helper';
import { html, svg } from '@/template/html';

describe('template/html', () => {
  describe('html', () => {
    it('builds a template literals object tagged as html', () => {
      const tpl = html`<div class="box">hello</div>`;

      expect(tpl[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.html);
      expect(tpl.values).toEqual([]);
      expect(Array.from(tpl.strings)).toEqual(['<div class="box">hello</div>']);
      expect(Object.isFrozen(tpl.template)).toBe(true);
    });

    it('parses a static template into a TNode tree rooted at template', () => {
      const tpl = html`<div class="box">hello</div>`;
      const root = tpl.template.node;

      expect(root.type).toBe(VNodeType.element);
      expect(root.value).toBe('template');
      expect(root.parent).toBeNull();

      const div = root.children?.[0];
      expect(div?.type).toBe(VNodeType.element);
      expect(div?.value).toBe('div');
      expect(div?.parent).toBe(root);
      expect(div?.staticAttrs).toEqual([
        { type: TAttrType.attribute, name: 'class', value: 'box' },
      ]);
      expect(div?.attrs).toBeUndefined();

      const text = div?.children?.[0];
      expect(text?.type).toBe(VNodeType.text);
      expect(text?.value).toBe('hello');
    });

    it('replaces every interpolation with an indexed marker', () => {
      const onClick = () => {};
      const tpl = html`<div
        class="a ${'b'}"
        .value=${1}
        @click=${onClick}
      ></div>`;
      const div = tpl.template.node.children?.[0];

      expect(tpl.values).toEqual(['b', 1, onClick]);
      expect(div?.attrs).toEqual([
        {
          type: TAttrType.attribute,
          name: 'class',
          value: `a ${createMarker(0)}`,
        },
        { type: TAttrType.property, name: 'value', value: createMarker(1) },
        { type: TAttrType.event, name: 'click', value: createMarker(2) },
      ]);
    });

    it('classifies boolean, spread and directive attributes', () => {
      const tpl = html`<div ?hidden=${true} ...${{ id: 'x' }}>${'d'}</div>`;
      const div = tpl.template.node.children?.[0];
      const types = div?.attrs?.map(attr => attr.type);

      expect(types).toContain(TAttrType.boolean);
      expect(types).toContain(TAttrType.spread);
      expect(div?.attrs?.find(attr => attr.type === TAttrType.boolean)).toEqual(
        { type: TAttrType.boolean, name: 'hidden', value: createMarker(0) }
      );
    });

    it('splits a text node around its markers', () => {
      const tpl = html`<div>hello ${'world'}<span>x</span></div>`;
      const div = tpl.template.node.children?.[0];

      expect(div?.children?.map(node => node.value)).toEqual([
        'hello ',
        createMarker(0),
        'span',
      ]);
    });

    it('keeps adjacent interpolations as separate marker text nodes', () => {
      const tpl = html`<div>${'a'}${'b'}</div>`;
      const div = tpl.template.node.children?.[0];

      expect(div?.children?.map(node => node.value)).toEqual([
        createMarker(0),
        createMarker(1),
      ]);
      expect(div?.children?.every(node => node.isMarkerOnly)).toBe(true);
    });

    it('supports a template that is nothing but an interpolation', () => {
      const tpl = html`${'a'}`;
      const node = tpl.template.node.children?.[0];

      expect(node?.type).toBe(VNodeType.text);
      expect(node?.value).toBe(createMarker(0));
      expect(node?.isMarker).toBe(true);
      expect(node?.isMarkerOnly).toBe(true);
    });

    it('registers the compiled template in the shared cache', () => {
      const tpl = html`<section data-html-spec="cache"></section>`;

      expect(templateCache.get(tpl.strings)).toBe(tpl.template);
    });

    it('reuses the cached template for the same call site', () => {
      const make = (value: string) => html`<div>${value}</div>`;
      const first = make('one');
      const second = make('two');

      expect(first.strings).toBe(second.strings);
      expect(first.template).toBe(second.template);
      expect(first.values).toEqual(['one']);
      expect(second.values).toEqual(['two']);
      expect(first).not.toBe(second);
    });

    it('compiles distinct call sites into distinct templates', () => {
      const a = html`<div data-html-spec="a"></div>`;
      const b = html`<div data-html-spec="b"></div>`;

      expect(a.template).not.toBe(b.template);
    });
  });

  describe('svg', () => {
    it('builds a template literals object tagged as svg', () => {
      const tpl = svg`<svg><circle cx=${1} /></svg>`;

      expect(tpl[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.svg);
      expect(tpl.values).toEqual([1]);

      const svgNode = tpl.template.node.children?.[0];
      expect(svgNode?.value).toBe('svg');
      expect(svgNode?.isSvg).toBe(true);

      const circle = svgNode?.children?.[0];
      expect(circle?.value).toBe('circle');
      expect(circle?.attrs).toEqual([
        { type: TAttrType.attribute, name: 'cx', value: createMarker(0) },
      ]);
    });

    it('shares the same cache as html', () => {
      const tpl = svg`<svg data-svg-spec="cache"></svg>`;

      expect(templateCache.get(tpl.strings)).toBe(tpl.template);
    });

    it('reuses the cached template for the same call site', () => {
      const make = (r: number) => svg`<circle r=${r} />`;
      const first = make(1);
      const second = make(2);

      expect(first.template).toBe(second.template);
      expect(first[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.svg);
      expect(second.values).toEqual([2]);
    });
  });
});
