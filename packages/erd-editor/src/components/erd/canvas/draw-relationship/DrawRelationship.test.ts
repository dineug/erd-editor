import { createRef, svg } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import * as styles from '@/components/erd/canvas/draw-relationship/DrawRelationship.styles';
import { RelationshipType } from '@/constants/schema';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { DrawRelationship as DrawRelationshipType } from '@/engine/modules/editor/state';
import { resizeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { getDraw } from '@/utils/draw-relationship/draw';

let mounted: Mounted | null = null;
let $root: HTMLDivElement | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  $root?.remove();
  $root = null;
  vi.restoreAllMocks();
});

const createDraw = (
  value: Partial<DrawRelationshipType> = {}
): DrawRelationshipType => ({
  relationshipType: RelationshipType.ZeroOne,
  start: { tableId: 't1', x: 200, y: 100 },
  end: { x: 500, y: 400 },
  ...value,
});

function createRoot(rect: Partial<DOMRect> = {}) {
  $root = document.createElement('div');
  document.body.append($root);
  vi.spyOn($root, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  return createRef<HTMLDivElement>($root);
}

const mountDraw = (draw: DrawRelationshipType, rect?: Partial<DOMRect>) =>
  mountAndFlush(
    svg`<${DrawRelationship} root=${createRoot(rect)} draw=${draw} />`
  );

const root = () => mounted!.container.querySelector('svg') as SVGSVGElement;

describe('DrawRelationship', () => {
  it('carries the root style class and the canvas size', async () => {
    mounted = await mountDraw(createDraw());
    mounted.app.store.dispatchSync(resizeAction({ width: 2400, height: 2200 }));
    await flush();

    const el = root();
    expect(el.getAttribute('class')).toContain(String(styles.root));
    expect(el.style.width).toBe('2400px');
    expect(el.style.height).toBe('2200px');
    expect(el.style.minWidth).toBe('2400px');
    expect(el.style.minHeight).toBe('2200px');
  });

  it('draws the preview path the draw helper produced', async () => {
    const draw = createDraw();
    mounted = await mountDraw(draw);
    const expected = getDraw(mounted.app.store.state, draw);

    const path = root().querySelector('path') as SVGPathElement;
    expect(path.getAttribute('d')).toBe(expected.path.path.d());
    expect(path.getAttribute('stroke-dasharray')).toBe('10');
    expect(path.getAttribute('fill')).toBe('transparent');
    expect(path.getAttribute('stroke-width')).toBe('3');
  });

  it('renders the start tick, base, base2 and center2 markers', async () => {
    const draw = createDraw();
    mounted = await mountDraw(draw);
    const { path, line } = getDraw(mounted.app.store.state, draw);

    const lines = Array.from(root().querySelectorAll('line'));
    expect(lines).toHaveLength(4);

    const xy = (el: Element) => [
      el.getAttribute('x1'),
      el.getAttribute('y1'),
      el.getAttribute('x2'),
      el.getAttribute('y2'),
    ];
    const toXY = (p: { x1: number; y1: number; x2: number; y2: number }) => [
      `${p.x1}`,
      `${p.y1}`,
      `${p.x2}`,
      `${p.y2}`,
    ];

    expect(xy(lines[0])).toEqual(toXY(path.line.start));
    expect(xy(lines[1])).toEqual(toXY(line.start.base));
    expect(xy(lines[2])).toEqual(toXY(line.start.base2));
    expect(xy(lines[3])).toEqual(toXY(line.start.center2));
    lines.forEach(el => expect(el.getAttribute('stroke-width')).toBe('3'));
  });

  it('falls back to a degenerate path when the draw has no start point', async () => {
    mounted = await mountDraw(createDraw({ start: null }));

    const path = root().querySelector('path') as SVGPathElement;
    expect(path.getAttribute('d')).toBe('M 0 0 L 0 0');

    const lines = Array.from(root().querySelectorAll('line'));
    lines.forEach(el => {
      expect(el.getAttribute('x1')).toBe('0');
      expect(el.getAttribute('y1')).toBe('0');
    });
  });

  it('tracks mousemove on the root element into the draw end point', async () => {
    mounted = await mountDraw(createDraw(), { x: 40, y: 25 });
    const { store } = mounted.app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 2 } })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();

    $root!.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 225,
        cancelable: true,
      })
    );
    await flush();

    expect(store.state.editor.drawRelationship?.end).toEqual({
      x: 260,
      y: 200,
    });
  });

  it('prevents the default mousemove behaviour so text is not selected', async () => {
    mounted = await mountDraw(createDraw());

    const event = new MouseEvent('mousemove', {
      clientX: 10,
      clientY: 10,
      cancelable: true,
    });
    $root!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops tracking mousemove once unmounted', async () => {
    mounted = await mountDraw(createDraw(), { x: 0, y: 0 });
    const { store } = mounted.app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 2 } })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();

    mounted.unmount();
    mounted = null;

    const event = new MouseEvent('mousemove', {
      clientX: 999,
      clientY: 999,
      cancelable: true,
    });
    $root!.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(store.state.editor.drawRelationship?.end).toEqual({ x: 0, y: 0 });
  });
});
