import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as canvasStyles from '@/components/erd/canvas/Canvas.styles';
import Minimap from '@/components/erd/minimap/Minimap';
import * as styles from '@/components/erd/minimap/Minimap.styles';
import { Show } from '@/constants/schema';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  vi.restoreAllMocks();
  mounted?.unmount();
  mounted = null;
});

const minimapOf = () =>
  mounted!.container.querySelector<HTMLElement>('.minimap')!;

const borderOf = () =>
  mounted!.container.querySelector<HTMLElement>(`.${String(styles.border)}`)!;

const canvasOf = () =>
  mounted!.container.querySelector<HTMLElement>(
    `.minimap > .${String(canvasStyles.root)}`
  )!;

const viewportOf = () =>
  mounted!.container.querySelector<HTMLElement>('.minimap-viewport')!;

const mount_ = async (app?: AppContext) => {
  mounted = await mountAndFlush(html`<${Minimap} />`, app);
  return mounted;
};

const stubRect = (x: number, y: number) =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    left: x,
    top: y,
    right: x,
    bottom: y,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect);

const touchAt = (clientX: number, clientY: number) =>
  new Touch({ identifier: 1, target: document.body, clientX, clientY });

describe('Minimap', () => {
  it('shrinks the full canvas box down to the minimap footprint', async () => {
    await mount_();

    const el = minimapOf();
    expect(el.classList.contains(String(styles.minimap))).toBe(true);
    // ratio = 150 / 2000 = 0.075
    expect(el.style.transform).toBe('scale(0.075)');
    expect(el.style.width).toBe('2000px');
    expect(el.style.height).toBe('2000px');
    // (-2000 / 2) + (2000 * 0.075 / 2) + 20
    expect(el.style.right).toBe('-905px');
    expect(el.style.top).toBe('-905px');
  });

  it('draws a fixed size border frame inset by one pixel', async () => {
    await mount_();

    const el = borderOf();
    expect(el).toBeTruthy();
    expect(el.style.width).toBe('150px');
    expect(el.style.height).toBe('150px');
    expect(el.style.right).toBe('19px');
    expect(el.style.top).toBe('19px');
  });

  it('mirrors the canvas size and zoom level on the inner canvas', async () => {
    const app = createTestAppContext();
    await mount_(app);

    const el = canvasOf();
    expect(el).toBeTruthy();
    expect(el.style.width).toBe('2000px');
    expect(el.style.height).toBe('2000px');
    expect(el.style.minWidth).toBe('2000px');
    expect(el.style.minHeight).toBe('2000px');
    expect(el.style.transform).toBe('scale(1)');

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    expect(canvasOf().style.transform).toBe('scale(0.5)');
  });

  it('renders one box per table and per memo in the document', async () => {
    const app = createTestAppContext();
    await mount_(app);

    expect(minimapOf().querySelectorAll('.table')).toHaveLength(0);
    expect(minimapOf().querySelectorAll('.memo')).toHaveLength(0);

    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 30, y: 40, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 50, y: 60, zIndex: 3 } })
    );
    await flush();

    const tables = minimapOf().querySelectorAll<HTMLElement>('.table');
    const memos = minimapOf().querySelectorAll<HTMLElement>('.memo');
    expect(tables).toHaveLength(2);
    expect(memos).toHaveLength(1);
    expect(tables[0].style.left).toBe('10px');
    expect(tables[1].style.top).toBe('40px');
    expect(memos[0].style.left).toBe('50px');
  });

  it('renders the relationship svg only while relationships are shown', async () => {
    const app = createTestAppContext();
    await mount_(app);

    const svg = minimapOf().querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.classList.contains(String(styles.canvasSvg))).toBe(true);

    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: false })
    );
    await flush();

    expect(minimapOf().querySelector('svg')).toBeNull();
  });

  it('scrolls the canvas so the pressed point becomes the viewport center', async () => {
    const app = createTestAppContext();
    await mount_(app);
    stubRect(10, 20);

    minimapOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 85, clientY: 50 })
    );
    await flush();

    // (85 - 10) / 0.075 = 1000 -> 1000 - 1200 / 2 = 400
    expect(app.store.state.settings.scrollLeft).toBe(-400);
    // (50 - 20) / 0.075 = 400 -> 400 - 675 / 2 = 62.5
    expect(app.store.state.settings.scrollTop).toBe(-62.5);
  });

  it('clamps the scroll to the canvas bounds', async () => {
    const app = createTestAppContext();
    await mount_(app);
    stubRect(0, 0);

    minimapOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 150, clientY: 150 })
    );
    await flush();

    // min scroll = viewport (1200 x 675) - canvas (2000 x 2000)
    expect(app.store.state.settings.scrollLeft).toBe(-800);
    expect(app.store.state.settings.scrollTop).toBe(-1325);
  });

  it('marks the viewport as selected for the duration of the press', async () => {
    const app = createTestAppContext();
    await mount_(app);
    stubRect(0, 0);

    expect(viewportOf().classList.contains('selected')).toBe(false);

    minimapOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 40 })
    );
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(true);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(false);
  });

  it('reads the press position from the first touch on touchstart', async () => {
    const app = createTestAppContext();
    await mount_(app);
    stubRect(10, 20);

    minimapOf().dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touchAt(85, 50)],
      })
    );
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-400);
    expect(app.store.state.settings.scrollTop).toBe(-62.5);
    expect(viewportOf().classList.contains('selected')).toBe(true);
  });

  it('keeps dragging the canvas after the initial press', async () => {
    const app = createTestAppContext();
    await mount_(app);
    stubRect(0, 0);

    minimapOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 60, clientY: 40 })
    );
    await flush();
    const afterPress = app.store.state.settings.scrollLeft;

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 70,
        clientY: 40,
      })
    );
    await flush();

    expect(afterPress).toBe(-200);
    expect(app.store.state.settings.scrollLeft).toBe(-333.3333);
  });
});
