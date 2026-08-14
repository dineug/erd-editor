import { svg } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import CanvasSvg from '@/components/erd/canvas/canvas-svg/CanvasSvg';
import * as styles from '@/components/erd/canvas/canvas-svg/CanvasSvg.styles';
import { RelationshipType } from '@/constants/schema';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { resizeAction } from '@/engine/modules/settings/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const addRelationship = (id: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroOne,
    start: { tableId: `${id}-start`, columnIds: [`${id}-sc`] },
    end: { tableId: `${id}-end`, columnIds: [`${id}-ec`] },
  });

const root = () => mounted!.container.querySelector('svg') as SVGSVGElement;

describe('CanvasSvg', () => {
  it('sizes the svg from the canvas settings', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} />`);
    mounted.app.store.dispatchSync(resizeAction({ width: 3000, height: 2500 }));
    await flush();

    const el = root();
    expect(el.style.width).toBe('3000px');
    expect(el.style.height).toBe('2500px');
    expect(el.style.minWidth).toBe('3000px');
    expect(el.style.minHeight).toBe('2500px');
  });

  it('always carries the root style class', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} />`);

    expect(root().getAttribute('class')).toContain(String(styles.root));
  });

  it('appends the class prop next to the root class', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} class=${'extra'} />`);

    const className = root().getAttribute('class') ?? '';
    expect(className).toContain(String(styles.root));
    expect(className).toContain('extra');
  });

  it('renders nothing when the document has no relationships', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} />`);

    expect(root().querySelectorAll('g.relationship')).toHaveLength(0);
  });

  it('renders one relationship group per document relationship id', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} />`);
    const { store } = mounted.app;

    store.dispatchSync(addRelationship('r1'));
    store.dispatchSync(addRelationship('r2'));
    await flush();

    const groups = Array.from(root().querySelectorAll('g.relationship'));
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.getAttribute('data-id'))).toEqual(['r1', 'r2']);
  });

  it('defaults the relationship stroke width to 3', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} />`);
    mounted.app.store.dispatchSync(addRelationship('r1'));
    await flush();

    const line = root().querySelector('g.relationship line') as SVGLineElement;
    expect(line.getAttribute('stroke-width')).toBe('3');
  });

  it('forwards the strokeWidth prop to every relationship', async () => {
    mounted = await mountAndFlush(svg`<${CanvasSvg} strokeWidth=${12} />`);
    mounted.app.store.dispatchSync(addRelationship('r1'));
    await flush();

    const line = root().querySelector('g.relationship line') as SVGLineElement;
    expect(line.getAttribute('stroke-width')).toBe('12');
  });
});
