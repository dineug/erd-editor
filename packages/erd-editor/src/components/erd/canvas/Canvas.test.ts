import { createRef, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Canvas from '@/components/erd/canvas/Canvas';
import * as styles from '@/components/erd/canvas/Canvas.styles';
import * as canvasSvgStyles from '@/components/erd/canvas/canvas-svg/CanvasSvg.styles';
import * as drawStyles from '@/components/erd/canvas/draw-relationship/DrawRelationship.styles';
import * as highLevelStyles from '@/components/erd/canvas/high-level-table/HighLevelTable.styles';
import { RelationshipType, Show } from '@/constants/schema';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;
let $root: HTMLDivElement | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  $root?.remove();
  $root = null;
});

function mountCanvas(grabMove?: boolean) {
  $root = document.createElement('div');
  document.body.append($root);
  const root = createRef<HTMLDivElement>($root);
  const canvas = createRef<HTMLDivElement>();

  return mountAndFlush(
    html`<${Canvas} root=${root} canvas=${canvas} grabMove=${grabMove} />`
  ).then(value => ({ ...value, root, canvas }));
}

const controller = () => mounted!.container.firstElementChild as HTMLDivElement;

const canvasEl = () =>
  controller().querySelector(`.${String(styles.root)}`) as HTMLDivElement;

describe('Canvas', () => {
  it('sizes the controller and the canvas from the settings', async () => {
    mounted = await mountCanvas();
    mounted.app.store.dispatchSync(resizeAction({ width: 2400, height: 2600 }));
    await flush();

    for (const el of [controller(), canvasEl()]) {
      expect(el.style.width).toBe('2400px');
      expect(el.style.height).toBe('2600px');
      expect(el.style.minWidth).toBe('2400px');
      expect(el.style.minHeight).toBe('2600px');
    }
  });

  it('applies the scroll offset and zoom level as a controller transform', async () => {
    mounted = await mountCanvas();
    const { store } = mounted.app;

    store.dispatchSync(scrollToAction({ scrollTop: -100, scrollLeft: -50 }));
    store.dispatchSync(changeZoomLevelAction({ value: 0.9 }));
    await flush();

    expect(controller().style.transform).toBe(
      'translate(-50px, -100px) scale(0.9)'
    );
  });

  it('keeps pointer events on the controller by default', async () => {
    mounted = await mountCanvas();

    expect(controller().style.pointerEvents).toBe('auto');
    expect(controller().getAttribute('class')).toContain(
      String(styles.controller)
    );
  });

  it('disables pointer events on the controller while grab moving', async () => {
    mounted = await mountCanvas(true);

    expect(controller().style.pointerEvents).toBe('none');
  });

  it('binds the canvas ref to the inner canvas element', async () => {
    const value = await mountCanvas();
    mounted = value;

    expect(value.canvas.value).toBe(canvasEl());
  });

  it('renders a full table per document table id above the high level zoom', async () => {
    mounted = await mountCanvas();
    const { store } = mounted.app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 2 } })
    );
    store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 30, y: 40, zIndex: 2 } })
    );
    await flush();

    const tables = Array.from(canvasEl().querySelectorAll('.table'));
    expect(tables.map(el => el.getAttribute('data-id'))).toEqual(['t1', 't2']);
    expect(
      canvasEl().querySelectorAll(`.${String(highLevelStyles.name)}`)
    ).toHaveLength(0);
    expect((tables[0] as HTMLElement).style.left).toBe('10px');
    expect((tables[0] as HTMLElement).style.top).toBe('20px');
  });

  it('swaps to high level tables at or below a zoom level of 0.7', async () => {
    mounted = await mountCanvas();
    const { store } = mounted.app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 2 } })
    );
    store.dispatchSync(changeZoomLevelAction({ value: 0.7 }));
    await flush();

    expect(canvasEl().querySelectorAll('.table')).toHaveLength(1);
    expect(
      canvasEl().querySelectorAll(`.${String(highLevelStyles.name)}`)
    ).toHaveLength(1);
  });

  it('renders a memo per document memo id', async () => {
    mounted = await mountCanvas();
    const { store } = mounted.app;

    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 5, y: 6, zIndex: 1 } })
    );
    await flush();

    const memos = Array.from(canvasEl().querySelectorAll('.memo'));
    expect(memos).toHaveLength(1);
    expect((memos[0] as HTMLElement).style.left).toBe('5px');
    expect((memos[0] as HTMLElement).style.top).toBe('6px');
    expect((memos[0] as HTMLElement).style.zIndex).toBe('1');
  });

  it('renders the relationship svg while the relationship show bit is set', async () => {
    mounted = await mountCanvas();
    const selector = `.${String(canvasSvgStyles.root)}`;

    expect(canvasEl().querySelector(selector)).toBeTruthy();

    mounted.app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: false })
    );
    await flush();
    expect(canvasEl().querySelector(selector)).toBeNull();

    mounted.app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: true })
    );
    await flush();
    expect(canvasEl().querySelector(selector)).toBeTruthy();
  });

  it('renders the draw relationship preview only once a start point exists', async () => {
    mounted = await mountCanvas();
    const { store } = mounted.app;
    const selector = `.${String(drawStyles.root)}`;

    expect(canvasEl().querySelector(selector)).toBeNull();

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 2 } })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    await flush();
    expect(canvasEl().querySelector(selector)).toBeNull();

    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();
    expect(canvasEl().querySelector(selector)).toBeTruthy();
  });
});
