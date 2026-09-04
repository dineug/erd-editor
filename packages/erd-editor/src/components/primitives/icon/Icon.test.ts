import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Icon from '@/components/primitives/icon/Icon';
import * as styles from '@/components/primitives/icon/Icon.styles';
import { RelationshipType } from '@/constants/schema';
import { getRelationshipIcon } from '@/utils/icon';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const wrapOf = () => mounted!.container.querySelector<HTMLElement>('div.icon');
const svgOf = () => mounted!.container.querySelector('svg');
const childrenOf = () => Array.from(svgOf()!.children);

const attrs = (element: Element) =>
  Object.fromEntries(
    Array.from(element.attributes).map(attr => [attr.name, attr.value])
  );

describe('Icon', () => {
  it('renders nothing when the name does not resolve to a registered icon', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'not-an-icon'} />`);

    expect(wrapOf()).toBeNull();
    expect(svgOf()).toBeNull();
  });

  it('renders nothing when no name is given, since the default empty name resolves to no icon', async () => {
    mounted = await mountAndFlush(html`<${Icon} />`);

    expect(wrapOf()).toBeNull();
  });

  it('carries the stroke defaults every glyph is drawn against on the svg root', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'check'} />`);

    const svg = svgOf()!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('renders exactly one svg per icon, however many children the glyph has', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'database'} />`);

    expect(mounted.container.querySelectorAll('svg').length).toBe(1);
    expect(childrenOf().length).toBe(3);
  });

  it('renders every child of a multi element icon in order, with its geometry', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'database'} />`);

    const children = childrenOf();
    expect(children.map(child => child.tagName)).toEqual([
      'ellipse',
      'path',
      'path',
    ]);
    expect(attrs(children[0])).toEqual({
      cx: '12',
      cy: '5',
      rx: '9',
      ry: '3',
      fill: 'none',
      stroke: 'currentColor',
    });
    expect(children[1].getAttribute('d')).toBe('M3 5V19A9 3 0 0 0 21 19V5');
    expect(children[2].getAttribute('d')).toBe('M3 12A9 3 0 0 0 21 12');
  });

  it('resolves a rect `ry` from its `rx` when the node declares only one', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'workflow'} />`);

    const rect = svgOf()!.querySelector('rect')!;
    expect(attrs(rect)).toEqual({
      x: '3',
      y: '3',
      width: '8',
      height: '8',
      rx: '2',
      ry: '2',
      fill: 'none',
      stroke: 'currentColor',
    });
  });

  it('draws a `line` child, which a glyph built from connectors depends on', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'share-2'} />`);

    const lines = childrenOf().filter(child => child.tagName === 'line');
    expect(lines.length).toBe(2);
    expect(attrs(lines[0])).toEqual({
      x1: '8.59',
      y1: '13.51',
      x2: '15.42',
      y2: '17.49',
      fill: 'none',
      stroke: 'currentColor',
    });
  });

  it('keeps a child own fill, so the painted dots survive the outlined root', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'palette'} />`);

    const children = childrenOf();
    const circles = children.filter(child => child.tagName === 'circle');
    expect(circles.length).toBe(4);
    for (const circle of circles) {
      expect(circle.getAttribute('fill')).toBe('currentColor');
      expect(circle.getAttribute('stroke')).toBe('currentColor');
    }

    const path = svgOf()!.querySelector('path')!;
    expect(path.getAttribute('fill')).toBe('none');
    expect(svgOf()!.getAttribute('fill')).toBe('none');
  });

  it('renders a notation glyph through the same svg root a lucide glyph gets', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} name=${'ZeroOne'} size=${20} />`
    );

    expect(mounted.container.querySelector('img')).toBeNull();
    const svg = svgOf()! as unknown as HTMLElement;
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.style.width).toBe('20px');
    expect(svg.style.height).toBe('20px');

    const children = childrenOf();
    expect(children.map(child => child.tagName)).toEqual([
      'path',
      'circle',
      'path',
      'path',
    ]);
    expect(attrs(children[1])).toEqual({
      cx: '10',
      cy: '12',
      r: '5',
      fill: 'none',
      stroke: 'currentColor',
    });
  });

  it('draws the glyph the draw-relationship cursor is serialized from', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'ZeroN'} />`);

    const host = document.createElement('div');
    host.innerHTML = decodeURIComponent(
      getRelationshipIcon(RelationshipType.ZeroN, false)!.replace(
        'data:image/svg+xml,',
        ''
      )
    );
    const geometry = (element: Element) => [
      element.tagName,
      ...['d', 'cx', 'cy', 'r'].map(name => element.getAttribute(name)),
    ];

    const ink = Array.from(host.querySelectorAll('g')).at(-1)!;
    expect(Array.from(ink.children).map(geometry)).toEqual(
      childrenOf().map(geometry)
    );
  });

  it('sizes every icon in px, defaulting to 18', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'check'} size=${24} />`);
    let svg = svgOf() as unknown as HTMLElement;
    expect(svg.style.width).toBe('24px');
    expect(svg.style.height).toBe('24px');
    mounted.unmount();

    mounted = await mountAndFlush(html`<${Icon} name=${'check'} />`);
    svg = svgOf() as unknown as HTMLElement;
    expect(svg.style.width).toBe('18px');
    expect(svg.style.height).toBe('18px');
  });

  it('omits the transition class unless useTransition is set', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'check'} />`);

    expect(svgOf()!.getAttribute('class') ?? '').not.toContain(
      String(styles.icon)
    );
  });

  it('applies the transition class when useTransition is set', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} name=${'check'} useTransition=${true} />`
    );

    expect(svgOf()!.getAttribute('class')).toContain(String(styles.icon));
  });

  it('carries the base classes plus any caller supplied class on the wrapper', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} name=${'check'} class=${'my-icon'} />`
    );

    const wrap = wrapOf()!;
    expect(wrap.classList.contains('icon')).toBe(true);
    expect(wrap.classList.contains(String(styles.wrap))).toBe(true);
    expect(wrap.classList.contains('my-icon')).toBe(true);
  });

  it('rotates by 0deg by default and by the rotate prop when given', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'check'} />`);
    expect(wrapOf()!.style.transform).toBe('rotate(0deg)');
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Icon} name=${'map-pin'} rotate=${90} />`
    );
    expect(wrapOf()!.style.transform).toBe('rotate(90deg)');
  });

  it('only sets the title attribute when a non empty title is passed', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'check'} />`);
    expect(wrapOf()!.hasAttribute('title')).toBe(false);
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Icon} name=${'check'} title=${''} />`
    );
    expect(wrapOf()!.hasAttribute('title')).toBe(false);
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Icon} name=${'key-round'} title=${'Primary key'} />`
    );
    expect(wrapOf()!.getAttribute('title')).toBe('Primary key');
  });

  it('forwards click, mouseenter and mouseleave from the wrapper', async () => {
    const onClick = vi.fn();
    const onMouseenter = vi.fn();
    const onMouseleave = vi.fn();

    mounted = await mountAndFlush(
      html`<${Icon}
        name=${'check'}
        .onClick=${onClick}
        .onMouseenter=${onMouseenter}
        .onMouseleave=${onMouseleave}
      />`
    );

    const wrap = wrapOf()!;
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('mouseenter'));
    wrap.dispatchEvent(new MouseEvent('mouseleave'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].type).toBe('click');
    expect(onMouseenter).toHaveBeenCalledTimes(1);
    expect(onMouseleave).toHaveBeenCalledTimes(1);
  });
});
