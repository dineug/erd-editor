import { createRef, html, Ref } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import HideSign from '@/components/erd/hide-sign/HideSign';
import * as styles from '@/components/erd/hide-sign/HideSign.styles';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/** The canvas is 2000x2000 at zoomLevel 1, so these are far outside it. */
const OUT = 6000;
const NEG = -5000;
const INSIDE = 1000;

/** Column-less table with the default 60px name width. */
const TABLE_WIDTH = 365;
const TABLE_HEIGHT = 56;
/** Default memo: 1 border + 8 padding + content + 8 padding + 1 border. */
const MEMO_WIDTH = 134;
const MEMO_HEIGHT = 134;

const ROOT_X = 40;
const ROOT_Y = 30;
const CLIENT_X = 300;
const CLIENT_Y = 400;
/** getMoveToPoint at zoomLevel 1 with no scroll: client - root origin. */
const POINT_X = CLIENT_X - ROOT_X;
const POINT_Y = CLIENT_Y - ROOT_Y;

function createRoot(): Ref<HTMLDivElement> {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
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
  return createRef<HTMLDivElement>(el);
}

async function mountHideSign(seed: (app: AppContext) => void) {
  const app = createTestAppContext();
  seed(app);
  mounted = await mountAndFlush(
    html`<${HideSign} root=${createRoot()} />`,
    app
  );
  return { app, container: mounted.container };
}

const addTable = (app: AppContext, id: string, x: number, y: number) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
};

const addMemo = (app: AppContext, id: string, x: number, y: number) => {
  app.store.dispatchSync(addMemoAction({ id, ui: { x, y, zIndex: 2 } }));
};

const signs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.hide-sign'));

const signByTitle = (container: HTMLElement, title: string) =>
  container.querySelector<HTMLElement>(`.hide-sign[title="${title}"]`)!;

const click = (el: HTMLElement, init: MouseEventInit = {}) => {
  el.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: CLIENT_X,
      clientY: CLIENT_Y,
      ...init,
    })
  );
};

describe('HideSign', () => {
  it('renders nothing while every table and memo overlaps the viewport', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'table-1', 200, 100);
      addMemo(app, 'memo-1', 400, 300);
    });

    expect(signs(container)).toHaveLength(0);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the document is empty', async () => {
    const { container } = await mountHideSign(() => {});

    expect(signs(container)).toHaveLength(0);
  });

  it('renders one sign per off-canvas table with the shared sign class and icon', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'hidden', NEG, INSIDE);
      addTable(app, 'visible', 200, 100);
    });

    const all = signs(container);
    expect(all).toHaveLength(1);

    const [sign] = all;
    expect(sign.tagName).toBe('DIV');
    expect(sign.classList.contains('hide-sign')).toBe(true);
    expect(sign.classList.contains(String(styles.sign))).toBe(true);
    expect(sign.querySelector('.icon')).toBeTruthy();
    expect(sign.querySelector('svg path')).toBeTruthy();
  });

  it('titles a table sign with its name and falls back to `unnamed`', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'named', NEG, INSIDE);
      addTable(app, 'blank', OUT, INSIDE);
      addTable(app, 'spaces', INSIDE, NEG);
      app.store.dispatchSync(
        changeTableNameAction({ id: 'named', value: 'users' })
      );
      app.store.dispatchSync(
        changeTableNameAction({ id: 'spaces', value: '   ' })
      );
    });

    const titles = signs(container).map(el => el.getAttribute('title'));
    expect(titles).toEqual(['users', 'unnamed', 'unnamed']);
  });

  it('labels every memo sign as `Memo` and renders them after the tables', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'table-1', NEG, INSIDE);
      addMemo(app, 'memo-1', OUT, INSIDE);
      addMemo(app, 'memo-2', INSIDE, OUT);
      app.store.dispatchSync(
        changeTableNameAction({ id: 'table-1', value: 'users' })
      );
    });

    const titles = signs(container).map(el => el.getAttribute('title'));
    expect(titles).toEqual(['users', 'Memo', 'Memo']);
  });

  it('keeps a table hidden while it only sticks out of the zoomed viewport', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'table-1', 2500, 100);
    });

    // x is past settings.width, but the zoomLevel-1 viewport rect is
    // 0..2000 and the 365px wide table starts at 2500 => really off-canvas.
    expect(signs(container)).toHaveLength(1);
    expect(signs(container)[0].style.right).toBe('0px');
  });

  const POSITION_CASES = [
    {
      name: 'lt',
      x: NEG,
      y: NEG,
      offsets: { left: '0px', top: '0px' },
      rotate: 135,
    },
    {
      name: 'rt',
      x: OUT,
      y: NEG,
      offsets: { right: '0px', top: '0px' },
      rotate: 225,
    },
    {
      name: 'lb',
      x: NEG,
      y: OUT,
      offsets: { left: '0px', bottom: '0px' },
      rotate: 45,
    },
    {
      name: 'rb',
      x: OUT,
      y: OUT,
      offsets: { right: '0px', bottom: '0px' },
      rotate: 315,
    },
    {
      name: 'left',
      x: NEG,
      y: INSIDE,
      offsets: { left: '0px', top: `${INSIDE}px` },
      rotate: 90,
    },
    {
      name: 'right',
      x: OUT,
      y: INSIDE,
      offsets: { right: '0px', top: `${INSIDE}px` },
      rotate: 270,
    },
    {
      name: 'top',
      x: INSIDE,
      y: NEG,
      offsets: { left: `${INSIDE}px`, top: '0px' },
      rotate: 180,
    },
    {
      name: 'bottom',
      x: INSIDE,
      y: OUT,
      offsets: { left: `${INSIDE}px`, bottom: '0px' },
      rotate: 0,
    },
  ];

  it.each(POSITION_CASES)(
    'pins the $name sign to its edge and rotates the icon $rotate degrees',
    async ({ name, x, y, offsets, rotate }) => {
      const { container } = await mountHideSign(app => {
        addTable(app, name, x, y);
        app.store.dispatchSync(
          changeTableNameAction({ id: name, value: name })
        );
      });

      const sign = signByTitle(container, name);
      expect(sign).toBeTruthy();
      expect(sign.style.left).toBe(offsets.left ?? '');
      expect(sign.style.right).toBe(offsets.right ?? '');
      expect(sign.style.top).toBe(offsets.top ?? '');
      expect(sign.style.bottom).toBe(offsets.bottom ?? '');

      const icon = sign.querySelector<HTMLElement>('.icon')!;
      expect(icon.style.transform).toBe(`rotate(${rotate}deg)`);
    }
  );

  it('offsets the edge-relative signs by the debounced canvas scroll', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'left-side', NEG, INSIDE);
      addTable(a, 'top-side', INSIDE, NEG);
      a.store.dispatchSync(
        changeTableNameAction({ id: 'left-side', value: 'left-side' })
      );
      a.store.dispatchSync(
        changeTableNameAction({ id: 'top-side', value: 'top-side' })
      );
    });

    expect(signByTitle(container, 'left-side').style.top).toBe(`${INSIDE}px`);
    expect(signByTitle(container, 'top-side').style.left).toBe(`${INSIDE}px`);

    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -200, scrollTop: -300 })
    );
    expect(app.store.state.settings.scrollLeft).toBe(-200);
    expect(app.store.state.settings.scrollTop).toBe(-300);

    // the scroll stream is debounced by 100ms before it reaches local state
    expect(signByTitle(container, 'left-side').style.top).toBe(`${INSIDE}px`);

    await new Promise(resolve => setTimeout(resolve, 160));
    await flush();

    expect(signByTitle(container, 'left-side').style.top).toBe('700px');
    expect(signByTitle(container, 'top-side').style.left).toBe('800px');
  });

  it('ignores settings changes that are not a scroll', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'left-side', NEG, INSIDE);
      a.store.dispatchSync(
        changeTableNameAction({ id: 'left-side', value: 'left-side' })
      );
    });

    app.store.state.settings.databaseName = 'shop';

    await new Promise(resolve => setTimeout(resolve, 160));
    await flush();

    expect(signByTitle(container, 'left-side').style.top).toBe(`${INSIDE}px`);
  });

  const TABLE_MOVE_CASES = [
    { name: 'lt', x: NEG, y: NEG, toX: POINT_X, toY: POINT_Y },
    { name: 'rt', x: OUT, y: NEG, toX: POINT_X - TABLE_WIDTH, toY: POINT_Y },
    { name: 'lb', x: NEG, y: OUT, toX: POINT_X, toY: POINT_Y - TABLE_HEIGHT },
    {
      name: 'rb',
      x: OUT,
      y: OUT,
      toX: POINT_X - TABLE_WIDTH,
      toY: POINT_Y - TABLE_HEIGHT,
    },
    { name: 'left', x: NEG, y: INSIDE, toX: POINT_X, toY: POINT_Y },
    {
      name: 'right',
      x: OUT,
      y: INSIDE,
      toX: POINT_X - TABLE_WIDTH,
      toY: POINT_Y,
    },
    { name: 'top', x: INSIDE, y: NEG, toX: POINT_X, toY: POINT_Y },
    {
      name: 'bottom',
      x: INSIDE,
      y: OUT,
      toX: POINT_X,
      toY: POINT_Y - TABLE_HEIGHT,
    },
  ];

  it.each(TABLE_MOVE_CASES)(
    'moves a $name table under the pointer, offset by its own size',
    async ({ name, x, y, toX, toY }) => {
      const { app, container } = await mountHideSign(a => {
        addTable(a, name, x, y);
      });

      click(signs(container)[0]);
      await flush();

      const table = app.store.state.collections.tableEntities[name];
      expect(table.ui.x).toBe(toX);
      expect(table.ui.y).toBe(toY);
    }
  );

  const MEMO_MOVE_CASES = [
    { name: 'lt', x: NEG, y: NEG, toX: POINT_X, toY: POINT_Y },
    { name: 'rt', x: OUT, y: NEG, toX: POINT_X - MEMO_WIDTH, toY: POINT_Y },
    { name: 'lb', x: NEG, y: OUT, toX: POINT_X, toY: POINT_Y - MEMO_HEIGHT },
    {
      name: 'rb',
      x: OUT,
      y: OUT,
      toX: POINT_X - MEMO_WIDTH,
      toY: POINT_Y - MEMO_HEIGHT,
    },
    { name: 'left', x: NEG, y: INSIDE, toX: POINT_X, toY: POINT_Y },
    {
      name: 'right',
      x: OUT,
      y: INSIDE,
      toX: POINT_X - MEMO_WIDTH,
      toY: POINT_Y,
    },
    { name: 'top', x: INSIDE, y: NEG, toX: POINT_X, toY: POINT_Y },
    {
      name: 'bottom',
      x: INSIDE,
      y: OUT,
      toX: POINT_X,
      toY: POINT_Y - MEMO_HEIGHT,
    },
  ];

  it.each(MEMO_MOVE_CASES)(
    'moves a $name memo under the pointer, offset by its own size',
    async ({ name, x, y, toX, toY }) => {
      const { app, container } = await mountHideSign(a => {
        addMemo(a, name, x, y);
      });

      click(signs(container)[0]);
      await flush();

      const memo = app.store.state.collections.memoEntities[name];
      expect(memo.ui.x).toBe(toX);
      expect(memo.ui.y).toBe(toY);
    }
  );

  it('takes the scroll offset out of the move-to point', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'table-1', NEG, INSIDE);
      a.store.dispatchSync(
        scrollToAction({ scrollLeft: -120, scrollTop: -80 })
      );
    });

    click(signs(container)[0]);
    await flush();

    const table = app.store.state.collections.tableEntities['table-1'];
    expect(table.ui.x).toBe(POINT_X + 120);
    expect(table.ui.y).toBe(POINT_Y + 80);
  });

  it('selects only the clicked table when no modifier is held', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'table-1', NEG, INSIDE);
      addTable(a, 'table-2', 200, 100);
      a.store.dispatchSync(selectAction({ 'table-2': SelectType.table }));
    });

    click(signs(container)[0]);
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      'table-1': SelectType.table,
    });
    expect(app.store.state.editor.focusTable?.tableId).toBe('table-1');
  });

  it('keeps the previous selection when the modifier key is held', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'table-1', NEG, INSIDE);
      addTable(a, 'table-2', 200, 100);
      a.store.dispatchSync(selectAction({ 'table-2': SelectType.table }));
    });

    click(signs(container)[0], { ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      'table-1': SelectType.table,
      'table-2': SelectType.table,
    });
  });

  it('selects the clicked memo and lifts it above everything else', async () => {
    const { app, container } = await mountHideSign(a => {
      addMemo(a, 'memo-1', NEG, INSIDE);
      addTable(a, 'table-1', 200, 100);
      a.store.dispatchSync(selectAction({ 'table-1': SelectType.table }));
    });

    click(signs(container)[0]);
    await flush();

    const memo = app.store.state.collections.memoEntities['memo-1'];
    expect(app.store.state.editor.selectedMap).toEqual({
      'memo-1': SelectType.memo,
    });
    expect(memo.ui.zIndex).toBeGreaterThan(2);
  });

  it('drops the sign once the click has pulled the table back into view', async () => {
    const { container } = await mountHideSign(app => {
      addTable(app, 'table-1', NEG, INSIDE);
    });

    expect(signs(container)).toHaveLength(1);

    click(signs(container)[0]);
    await flush();

    expect(signs(container)).toHaveLength(0);
  });

  it('re-renders the sign list when a table is dragged off-canvas later', async () => {
    const { app, container } = await mountHideSign(a => {
      addTable(a, 'table-1', 200, 100);
    });

    expect(signs(container)).toHaveLength(0);

    app.store.state.collections.tableEntities['table-1'].ui.x = NEG;
    await flush();

    expect(signs(container)).toHaveLength(1);
    expect(signs(container)[0].getAttribute('title')).toBe('unnamed');
  });
});
