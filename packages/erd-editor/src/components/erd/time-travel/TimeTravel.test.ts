import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import TimeTravel from '@/components/erd/time-travel/TimeTravel';
import * as styles from '@/components/erd/time-travel/TimeTravel.styles';
import * as sliderStyles from '@/components/primitives/slider/Slider.styles';
import { createHistory, History, HistoryOptions } from '@/engine/history';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

let mounted: Mounted | null = null;

afterEach(() => {
  // closes any drag$ subscription the slider left open
  window.dispatchEvent(new MouseEvent('mouseup'));
  mounted?.unmount();
  mounted = null;
});

const RECT_WIDTH = 200;

/**
 * Wraps a real history so the clone handed to the inner TimeTravel store stays
 * observable from the test.
 */
function traceHistory(base: History, onClone: (history: History) => void) {
  const traced: History = Object.freeze({
    get cursor() {
      return base.cursor;
    },
    get size() {
      return base.size;
    },
    hasUndo: base.hasUndo,
    hasRedo: base.hasRedo,
    undo: base.undo,
    redo: base.redo,
    push: base.push,
    clear: base.clear,
    setLimit: base.setLimit,
    clone: (options: HistoryOptions) =>
      traceHistory(base.clone(options), onClone),
  });

  onClone(traced);
  return traced;
}

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } });

type Setup = {
  tableIds?: string[];
  viewport?: { width: number; height: number };
};

async function setup({
  tableIds = ['t1', 't2'],
  viewport = { width: 1000, height: 800 },
}: Setup = {}) {
  const histories: History[] = [];
  const originApp: AppContext = createTestAppContext({
    getHistory: options =>
      traceHistory(createHistory(options), history => histories.push(history)),
  });

  originApp.store.dispatchSync(changeViewportAction(viewport));
  for (const id of tableIds) {
    originApp.store.dispatchSync(addTable(id));
  }
  await flush();

  const onChange = vi.fn();
  const onClose = vi.fn();

  mounted = await mountAndFlush(
    html`<${TimeTravel}
      app=${{ value: originApp }}
      .onChange=${onChange}
      .onClose=${onClose}
    />`,
    originApp
  );

  return {
    originApp,
    onChange,
    onClose,
    // [0] is the origin history, [1] is the clone owned by the inner store
    clonedHistory: histories[1],
  };
}

const container = () => mounted!.container;

const sliderRoot = () => {
  const el = container().querySelector(
    `.${String(sliderStyles.root)}`
  ) as HTMLDivElement;
  Reflect.set(el, 'getBoundingClientRect', () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: RECT_WIDTH,
    bottom: 12,
    width: RECT_WIDTH,
    height: 12,
    toJSON: () => ({}),
  }));
  return el;
};

const buttons = () =>
  Array.from(container().querySelectorAll('button')) as HTMLButtonElement[];

const buttonByText = (text: string) =>
  buttons().find(button => button.textContent?.includes(text)) as
    | HTMLButtonElement
    | undefined;

const tableCount = () => container().querySelectorAll('.table').length;

/** min = -1, max = size - 1, so ratio 0 is -1 and ratio 1 is the newest entry. */
const slideTo = async (ratio: number) => {
  sliderRoot().dispatchEvent(
    new MouseEvent('mousedown', { clientX: RECT_WIDTH * ratio })
  );
  await flush();
};

describe('TimeTravel', () => {
  describe('rendering', () => {
    it('renders the overlay, the preview container and the slider bar', async () => {
      await setup();

      const root = container().querySelector(`.${String(styles.root)}`);
      const preview = container().querySelector(`.${String(styles.container)}`);
      const slider = container().querySelector(`.${String(styles.slider)}`);

      expect(root).toBeTruthy();
      expect(root?.contains(preview as Node)).toBe(true);
      expect(slider).toBeTruthy();
      expect(root?.contains(slider as Node)).toBe(false);
    });

    it('renders the canvas preview and the minimap inside the container', async () => {
      await setup();

      const preview = container().querySelector(
        `.${String(styles.container)}`
      ) as HTMLElement;

      expect(preview.querySelector('.minimap')).toBeTruthy();
      expect(preview.querySelector('.minimap-viewport')).toBeTruthy();
    });

    it('renders the apply and cancel buttons separated by a spacer', async () => {
      await setup();

      expect(buttons()).toHaveLength(2);
      expect(buttonByText('Apply')).toBeTruthy();
      expect(buttonByText('Cancel')).toBeTruthy();
      expect(
        container().querySelectorAll(`.${String(styles.vertical)}`)
      ).toHaveLength(1);
    });

    it('mirrors the origin document into the isolated preview store', async () => {
      await setup({ tableIds: ['t1', 't2'] });

      // one node per table on the canvas plus one on the minimap
      expect(tableCount()).toBe(4);
    });

    it('copies the origin viewport into the preview store on creation', async () => {
      await setup({ viewport: { width: 1000, height: 800 } });

      const viewport = container().querySelector(
        '.minimap-viewport'
      ) as HTMLElement;

      // MINIMAP_SIZE / settings.width = 150 / 2000 = 0.075
      expect(viewport.style.width).toBe('75px');
      expect(viewport.style.height).toBe('60px');
    });

    it('follows later viewport changes on the origin store', async () => {
      const { originApp } = await setup({
        viewport: { width: 1000, height: 800 },
      });

      originApp.store.dispatchSync(
        changeViewportAction({ width: 2000, height: 400 })
      );
      await flush();

      const viewport = container().querySelector(
        '.minimap-viewport'
      ) as HTMLElement;
      expect(viewport.style.width).toBe('150px');
      expect(viewport.style.height).toBe('30px');
    });

    it('parks the slider on the newest history entry', async () => {
      await setup({ tableIds: ['t1', 't2'] });

      const range = container().querySelector(
        `.${String(sliderStyles.range)}`
      ) as HTMLElement;
      // cursor 1 of min -1 / max 1 is the far right of the track
      expect(range.style.right).toBe('0%');
    });
  });

  describe('travelling', () => {
    it('rewinds the preview one step without touching the origin store', async () => {
      const { originApp, clonedHistory } = await setup({
        tableIds: ['t1', 't2'],
      });

      await slideTo(0.5);

      expect(clonedHistory.cursor).toBe(0);
      expect(tableCount()).toBe(2);
      expect(originApp.store.state.doc.tableIds).toEqual(['t1', 't2']);
      expect(originApp.store.history.cursor).toBe(1);
    });

    it('rewinds all the way to the empty document', async () => {
      const { clonedHistory } = await setup({ tableIds: ['t1', 't2'] });

      await slideTo(0);

      expect(clonedHistory.cursor).toBe(-1);
      expect(tableCount()).toBe(0);
    });

    it('moves the cursor forward again when the slider goes back right', async () => {
      const { clonedHistory } = await setup({ tableIds: ['t1', 't2'] });

      await slideTo(0);
      expect(clonedHistory.cursor).toBe(-1);

      await slideTo(1);

      expect(clonedHistory.cursor).toBe(1);
    });

    it('resurrects the rewound tables when replaying forward', async () => {
      // The cloned history stamps versions from the preview store clock, so
      // every replayed add outranks the remove version the rewind wrote and
      // passes the add operator's version check.
      const { originApp } = await setup({ tableIds: ['t1', 't2'] });

      await slideTo(0);
      expect(tableCount()).toBe(0);

      await slideTo(1);

      // one node per table on the canvas plus one on the minimap
      expect(tableCount()).toBe(4);
      expect(originApp.store.state.doc.tableIds).toEqual(['t1', 't2']);
    });

    it('moves the slider fill along with the cursor', async () => {
      await setup({ tableIds: ['t1', 't2'] });

      await slideTo(0);

      const range = container().querySelector(
        `.${String(sliderStyles.range)}`
      ) as HTMLElement;
      expect(range.style.right).toBe('100%');
    });
  });

  describe('apply and close', () => {
    it('reports the selected cursor and closes on apply', async () => {
      const { onChange, onClose } = await setup({ tableIds: ['t1', 't2'] });

      await slideTo(0.5);
      buttonByText('Apply')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(0);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('applies the untouched cursor when nothing was dragged', async () => {
      const { onChange } = await setup({ tableIds: ['t1', 't2'] });

      buttonByText('Apply')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('closes without reporting a cursor on cancel', async () => {
      const { onChange, onClose } = await setup();

      buttonByText('Cancel')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('closes on the stop shortcut from the origin app', async () => {
      const { originApp, onClose } = await setup();

      originApp.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown'),
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores any other shortcut', async () => {
      const { originApp, onClose } = await setup();

      originApp.shortcut$.next({
        type: KeyBindingName.undo,
        event: new KeyboardEvent('keydown'),
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('teardown', () => {
    it('destroys the preview store and its cloned history on unmount', async () => {
      const { clonedHistory } = await setup({ tableIds: ['t1', 't2'] });
      expect(clonedHistory.size).toBe(2);

      mounted?.unmount();
      mounted = null;

      expect(clonedHistory.size).toBe(0);
      expect(clonedHistory.cursor).toBe(-1);
    });

    it('stops following the origin viewport after unmount', async () => {
      const { originApp } = await setup();

      mounted?.unmount();
      mounted = null;
      originApp.store.dispatchSync(
        changeViewportAction({ width: 123, height: 456 })
      );
      await flush();

      expect(document.querySelectorAll('.minimap-viewport')).toHaveLength(0);
    });
  });
});
