import { createRef, html, Ref } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import DragSelect from '@/components/erd/drag-select/DragSelect';
import * as styles from '@/components/erd/drag-select/DragSelect.styles';
import { SelectType } from '@/engine/modules/editor/state';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

// happy-dom measures everything as 0x0 at (0, 0); the root gets a deliberate
// origin so the component has to subtract it from the pointer position.
const ROOT_X = 30;
const ROOT_Y = 15;

let mounted: Mounted | null = null;
let app: AppContext;
let $root: HTMLDivElement;
let root: Ref<HTMLDivElement>;
let onDragSelectEnd: ReturnType<typeof vi.fn>;

const mount = (x = 0, y = 0) =>
  mountAndFlush(
    html`
      <${DragSelect}
        root=${root}
        x=${x}
        y=${y}
        .onDragSelectEnd=${onDragSelectEnd}
      />
    `,
    app
  );

const moveTo = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousemove', {
    clientX: ROOT_X + clientX,
    clientY: ROOT_Y + clientY,
    bubbles: true,
    cancelable: true,
  });
  $root.dispatchEvent(event);
  return event;
};

const box = () =>
  mounted!.container.querySelector('svg') as SVGSVGElement | null;

const rect = () =>
  mounted!.container.querySelector('rect') as SVGRectElement | null;

// An empty table renders 365x56, so its 15x15 center box sits at (167.5, 13).
const seedTable = (id: string, x = 0, y = 0) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
};

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: ROOT_X,
    y: ROOT_Y,
    left: ROOT_X,
    top: ROOT_Y,
    right: ROOT_X,
    bottom: ROOT_Y,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect);

  app = createTestAppContext();
  onDragSelectEnd = vi.fn();
  $root = document.createElement('div');
  document.body.append($root);
  root = createRef<HTMLDivElement>();
  root.value = $root;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  $root.remove();
  vi.restoreAllMocks();
});

describe('DragSelect', () => {
  it('renders a collapsed selection box before the pointer moves', async () => {
    mounted = await mount(40, 20);

    const $svg = box();
    expect($svg).toBeTruthy();
    expect($svg!.classList.contains(String(styles.dragSelect))).toBe(true);
    expect($svg!.style.top).toBe('0px');
    expect($svg!.style.left).toBe('0px');
    expect($svg!.style.width).toBe('0px');
    expect($svg!.style.height).toBe('0px');
    expect(rect()!.getAttribute('width')).toBe('0');
    expect(rect()!.getAttribute('height')).toBe('0');
  });

  it('gives the rect the dashed stroke the editor expects', async () => {
    mounted = await mount();

    const $rect = rect()!;
    expect($rect.getAttribute('stroke-width')).toBe('1');
    expect($rect.getAttribute('stroke-opacity')).toBe('1');
    expect($rect.getAttribute('stroke-dasharray')).toBe('3');
    expect($rect.getAttribute('fill-opacity')).toBe('0.3');
  });

  it('grows the box from the anchor towards the pointer', async () => {
    mounted = await mount(100, 50);

    const event = moveTo(300, 200);
    await flush();

    expect(event.defaultPrevented).toBe(true);

    const $svg = box()!;
    expect($svg.style.left).toBe('100px');
    expect($svg.style.top).toBe('50px');
    expect($svg.style.width).toBe('200px');
    expect($svg.style.height).toBe('150px');
    expect(rect()!.getAttribute('width')).toBe('200');
    expect(rect()!.getAttribute('height')).toBe('150');
  });

  it('grows the box backwards when the pointer moves above and left of the anchor', async () => {
    mounted = await mount(300, 300);

    moveTo(100, 50);
    await flush();

    const $svg = box()!;
    expect($svg.style.left).toBe('100px');
    expect($svg.style.top).toBe('50px');
    expect($svg.style.width).toBe('200px');
    expect($svg.style.height).toBe('250px');
  });

  it('collapses to zero when the pointer sits exactly on the anchor', async () => {
    mounted = await mount(120, 90);

    moveTo(120, 90);
    await flush();

    const $svg = box()!;
    expect($svg.style.width).toBe('0px');
    expect($svg.style.height).toBe('0px');
    expect($svg.style.left).toBe('120px');
    expect($svg.style.top).toBe('90px');
  });

  it('tracks a second move instead of accumulating the first one', async () => {
    mounted = await mount(0, 0);

    moveTo(300, 300);
    await flush();
    moveTo(120, 90);
    await flush();

    const $svg = box()!;
    expect($svg.style.width).toBe('120px');
    expect($svg.style.height).toBe('90px');
  });

  it('selects the tables whose center overlaps the dragged rect', async () => {
    seedTable('t1', 0, 0);
    seedTable('t2', 5000, 5000);
    mounted = await mount(0, 0);

    moveTo(300, 300);
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      t1: SelectType.table,
    });
  });

  it('shifts the dragged rect by the current canvas scroll', async () => {
    seedTable('t1', 0, 0);
    seedTable('t2', 0, 100);
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -100, scrollTop: -100 })
    );
    mounted = await mount(0, 0);

    moveTo(300, 300);
    await flush();

    // Without the scroll both tables overlap; the -100 shift drops t1.
    expect(app.store.state.editor.selectedMap).toEqual({
      t2: SelectType.table,
    });
  });

  it('maps the rect into canvas space using the zoom level', async () => {
    seedTable('t1', 0, 0);
    seedTable('t2', -800, -800);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    mounted = await mount(0, 0);

    moveTo(300, 300);
    await flush();

    // At 50% zoom the 0..300 screen rect maps to -1000..-400 on the canvas.
    expect(app.store.state.editor.selectedMap).toEqual({
      t2: SelectType.table,
    });
  });

  it('unselects everything when the dragged rect covers nothing', async () => {
    seedTable('t1', 5000, 5000);
    mounted = await mount(0, 0);

    moveTo(10, 10);
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({});
  });

  it('reports the end of the drag on the global mouseup', async () => {
    mounted = await mount(0, 0);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(onDragSelectEnd).toHaveBeenCalledTimes(1);
  });

  it('stops listening to the root and to mouseup once unmounted', async () => {
    mounted = await mount(0, 0);
    moveTo(300, 300);
    await flush();

    mounted.unmount();
    mounted = null;

    const event = moveTo(50, 50);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(onDragSelectEnd).not.toHaveBeenCalled();
  });
});
