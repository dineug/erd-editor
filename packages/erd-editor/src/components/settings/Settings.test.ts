import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Settings from '@/components/settings/Settings';
import * as styles from '@/components/settings/Settings.styles';
import { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import * as lnbStyles from '@/components/settings/settings-lnb/SettingsLnb.styles';
import * as shortcutsStyles from '@/components/settings/shortcuts/Shortcuts.styles';
import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { ColumnType, SaveSettingType } from '@/constants/schema';
import {
  changeIgnoreSaveSettingsAction,
  changeMaxWidthCommentAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { fontSize6 } from '@/styles/typography.styles';
import { bHas } from '@/utils/bit';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

const root = () =>
  mounted!.container.querySelector(`.${styles.root}`) as HTMLDivElement;

const rows = () =>
  Array.from<HTMLDivElement>(root().querySelectorAll(`.${styles.row}`));

const switchIn = (rowIndex: number) =>
  rows()[rowIndex].querySelector('button') as HTMLButtonElement;

const maxWidthInput = () =>
  root().querySelector(
    'input[title="Maximum comment width"]'
  ) as HTMLInputElement;

const columnOrderItems = () =>
  Array.from<HTMLDivElement>(
    root().querySelectorAll(`.${styles.columnOrderItem}`)
  );

const lnbItems = () =>
  Array.from<HTMLDivElement>(root().querySelectorAll(`.${lnbStyles.item}`));

const heading = () =>
  root().querySelector(
    `.${styles.contentArea} > .${fontSize6}`
  ) as HTMLDivElement;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const fire = (el: Element, type: string) =>
  el.dispatchEvent(new Event(type, { bubbles: true }));

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function setup() {
  mounted = await mountAndFlush(html`<${Settings} />`);
  return mounted;
}

describe('Settings', () => {
  describe('layout', () => {
    it('renders the lnb column next to the content column', async () => {
      const { container } = await setup();

      expect(root()).toBeTruthy();
      expect(container.querySelector(`.${styles.lnbArea}`)).toBeTruthy();
      expect(container.querySelector(`.${styles.contentArea}`)).toBeTruthy();
      expect(container.querySelector(`.${lnbStyles.lnb}`)).toBeTruthy();
    });

    it('marks the scrollable content wrapper with the scrollbar hook class', async () => {
      await setup();
      const content = root().querySelector(
        `.${styles.content}`
      ) as HTMLDivElement;

      expect(content.getAttribute('class')).toContain('scrollbar');
    });

    it('opens on the Preferences panel', async () => {
      await setup();

      expect(heading().textContent?.trim()).toBe(Lnb.preferences);
      expect(lnbItems()[0].classList.contains('selected')).toBe(true);
      expect(root().querySelector(`.${styles.section}`)).toBeTruthy();
    });

    it('renders the five preference rows in order', async () => {
      await setup();

      expect(
        rows().map(row => row.firstElementChild?.textContent?.trim())
      ).toEqual([
        'Relationship DataType Sync',
        'Save Scroll Information',
        'Save Zoom Information',
        'Maximum comment width',
        'Recalculation table width',
      ]);
    });
  });

  describe('lnb navigation', () => {
    it('swaps the panel to Shortcuts when the lnb item is clicked', async () => {
      await setup();

      click(lnbItems()[1]);
      await flush();

      expect(heading().textContent?.trim()).toBe(Lnb.shortcuts);
      expect(root().querySelector(`.${shortcutsStyles.table}`)).toBeTruthy();
      expect(root().querySelector(`.${styles.section}`)).toBeNull();
      expect(columnOrderItems()).toHaveLength(0);
    });

    it('returns to Preferences when the first lnb item is clicked again', async () => {
      await setup();

      click(lnbItems()[1]);
      await flush();
      click(lnbItems()[0]);
      await flush();

      expect(heading().textContent?.trim()).toBe(Lnb.preferences);
      expect(root().querySelector(`.${shortcutsStyles.table}`)).toBeNull();
      expect(root().querySelector(`.${styles.section}`)).toBeTruthy();
    });
  });

  describe('relationship datatype sync', () => {
    it('reflects the current setting', async () => {
      const { app } = await setup();

      expect(app.store.state.settings.relationshipDataTypeSync).toBe(true);
      expect(switchIn(0).getAttribute('data-checked')).toBe('true');
    });

    it('dispatches the inverted value on toggle', async () => {
      const { app } = await setup();

      click(switchIn(0));
      await flush();

      expect(app.store.state.settings.relationshipDataTypeSync).toBe(false);
      expect(switchIn(0).getAttribute('data-checked')).toBe('false');

      click(switchIn(0));
      await flush();

      expect(app.store.state.settings.relationshipDataTypeSync).toBe(true);
    });
  });

  describe('save settings switches', () => {
    it('shows scroll and zoom as saved while the ignore bits are clear', async () => {
      const { app } = await setup();

      expect(app.store.state.settings.ignoreSaveSettings).toBe(0);
      expect(switchIn(1).getAttribute('data-checked')).toBe('true');
      expect(switchIn(2).getAttribute('data-checked')).toBe('true');
    });

    it('sets the scroll ignore bit when the scroll switch is turned off', async () => {
      const { app } = await setup();

      click(switchIn(1));
      await flush();

      const { ignoreSaveSettings } = app.store.state.settings;
      expect(bHas(ignoreSaveSettings, SaveSettingType.scroll)).toBe(true);
      expect(bHas(ignoreSaveSettings, SaveSettingType.zoomLevel)).toBe(false);
      expect(switchIn(1).getAttribute('data-checked')).toBe('false');
    });

    it('clears the scroll ignore bit again when turned back on', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        changeIgnoreSaveSettingsAction({
          saveSettingType: SaveSettingType.scroll,
          value: true,
        })
      );
      await flush();
      expect(switchIn(1).getAttribute('data-checked')).toBe('false');

      click(switchIn(1));
      await flush();

      expect(
        bHas(
          app.store.state.settings.ignoreSaveSettings,
          SaveSettingType.scroll
        )
      ).toBe(false);
    });

    it('sets only the zoom ignore bit when the zoom switch is turned off', async () => {
      const { app } = await setup();

      click(switchIn(2));
      await flush();

      const { ignoreSaveSettings } = app.store.state.settings;
      expect(bHas(ignoreSaveSettings, SaveSettingType.zoomLevel)).toBe(true);
      expect(bHas(ignoreSaveSettings, SaveSettingType.scroll)).toBe(false);
    });
  });

  describe('maximum comment width', () => {
    it('renders disabled with the minimum width while the setting is -1', async () => {
      const { app } = await setup();

      expect(app.store.state.settings.maxWidthComment).toBe(-1);
      expect(switchIn(3).getAttribute('data-checked')).toBe('false');
      expect(maxWidthInput().disabled).toBe(true);
      expect(maxWidthInput().value).toBe(`${COLUMN_MIN_WIDTH}px`);
    });

    it('enables the input with the column minimum when switched on', async () => {
      const { app } = await setup();

      click(switchIn(3));
      await flush();

      expect(app.store.state.settings.maxWidthComment).toBe(COLUMN_MIN_WIDTH);
      expect(switchIn(3).getAttribute('data-checked')).toBe('true');
      expect(maxWidthInput().disabled).toBe(false);
      expect(maxWidthInput().value).toBe('60px');
    });

    it('disables it again by storing -1 when switched off', async () => {
      const { app } = await setup();
      app.store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      await flush();
      expect(maxWidthInput().value).toBe('120px');

      click(switchIn(3));
      await flush();

      expect(app.store.state.settings.maxWidthComment).toBe(-1);
      expect(maxWidthInput().disabled).toBe(true);
    });

    it('commits a typed width and rewrites the input in px format', async () => {
      const { app } = await setup();
      app.store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      await flush();

      const input = maxWidthInput();
      input.value = '150';
      fire(input, 'change');

      expect(input.value).toBe('150px');
      await flush();
      expect(app.store.state.settings.maxWidthComment).toBe(150);
    });

    it('clamps a value above the maximum down to 200', async () => {
      const { app } = await setup();
      app.store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      await flush();

      const input = maxWidthInput();
      input.value = '9999';
      fire(input, 'change');

      expect(input.value).toBe('200px');
      await flush();
      expect(app.store.state.settings.maxWidthComment).toBe(200);
    });

    it('strips non digits and clamps up to the column minimum', async () => {
      const { app } = await setup();
      app.store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      await flush();

      const input = maxWidthInput();
      input.value = 'a1b2c';
      fire(input, 'change');

      expect(input.value).toBe('60px');
      await flush();
      expect(app.store.state.settings.maxWidthComment).toBe(COLUMN_MIN_WIDTH);
    });
  });

  describe('recalculation table width', () => {
    it('recalculates every table width from the injected toWidth', async () => {
      const { app } = await setup();
      app.store.dispatchSync(
        addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 2 } })
      );
      const table = app.store.state.collections.tableEntities['table-1'];
      table.name = 'a-long-table-name';
      table.ui.widthName = 1;
      await flush();

      const button = rows()[4].querySelector('button') as HTMLButtonElement;
      click(button);
      await flush();

      expect(table.ui.widthName).toBe('a-long-table-name'.length * 10);
    });

    it('emits an openToast action with the confirmation message', async () => {
      const { app } = await setup();
      const openToast = vi.fn();
      app.emitter.on({ openToast });

      click(rows()[4].querySelector('button') as HTMLButtonElement);
      await flush();

      expect(openToast).toHaveBeenCalledTimes(1);
      const action = openToast.mock.calls[0][0];
      expect(action.type).toBe('openToast');
      expect(action.payload.message).toBeTruthy();
      expect(action.payload.close).toBeInstanceOf(Promise);
    });
  });

  describe('column order', () => {
    it('renders one draggable row per column type in the stored order', async () => {
      const { app } = await setup();
      const items = columnOrderItems();

      expect(items).toHaveLength(app.store.state.settings.columnOrder.length);
      expect(items.map(el => el.dataset.id)).toEqual(
        app.store.state.settings.columnOrder.map(String)
      );
      expect(items.map(el => el.textContent?.trim())).toEqual([
        'Name',
        'DataType',
        'Not Null',
        'Unique',
        'Auto Increment',
        'Default',
        'Comment',
      ]);
      expect(items.every(el => el.getAttribute('draggable') === 'true')).toBe(
        true
      );
    });

    it('prevents the default of dragenter and dragover on the list', async () => {
      await setup();
      const list = root().querySelector(
        `.${styles.columnOrderList}`
      ) as HTMLDivElement;

      const dragenter = new Event('dragenter', {
        bubbles: true,
        cancelable: true,
      });
      const dragover = new Event('dragover', {
        bubbles: true,
        cancelable: true,
      });
      list.dispatchEvent(dragenter);
      list.dispatchEvent(dragover);

      expect(dragenter.defaultPrevented).toBe(true);
      expect(dragover.defaultPrevented).toBe(true);
    });

    it('marks the dragged row and suppresses hover on the rest', async () => {
      await setup();
      const items = columnOrderItems();

      fire(items[0], 'dragstart');

      expect(items[0].classList.contains('dragging')).toBe(true);
      expect(items.every(el => el.classList.contains('none-hover'))).toBe(true);
    });

    it('ignores a dragstart bubbling from a child without a data-id', async () => {
      await setup();
      const items = columnOrderItems();
      const inner = items[0].firstElementChild as HTMLElement;

      expect(inner).toBeTruthy();
      expect(inner.dataset.id).toBeUndefined();
      fire(inner, 'dragstart');

      expect(items[0].classList.contains('dragging')).toBe(false);
      expect(items.some(el => el.classList.contains('none-hover'))).toBe(false);
    });

    it('reorders the column when dragged over another row', async () => {
      const { app } = await setup();
      const items = columnOrderItems();

      fire(items[0], 'dragstart');
      fire(items[2], 'dragover');
      await wait(120);
      await flush();

      expect(app.store.state.settings.columnOrder).toEqual([
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnName,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        ColumnType.columnComment,
      ]);
      expect(columnOrderItems().map(el => el.textContent?.trim())).toEqual([
        'DataType',
        'Not Null',
        'Name',
        'Unique',
        'Auto Increment',
        'Default',
        'Comment',
      ]);
    });

    it('takes a flip snapshot before the reorder dispatch', async () => {
      await setup();
      const rect = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockReturnValue({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect);
      const items = columnOrderItems();

      fire(items[0], 'dragstart');
      fire(items[1], 'dragover');
      await wait(120);
      await flush();

      expect(rect).toHaveBeenCalled();
    });

    it('does not reorder when dragged over itself', async () => {
      const { app } = await setup();
      const before = [...app.store.state.settings.columnOrder];
      const items = columnOrderItems();

      fire(items[0], 'dragstart');
      fire(items[0], 'dragover');
      await wait(120);
      await flush();

      expect(app.store.state.settings.columnOrder).toEqual(before);
    });

    it('clears the drag classes on dragend', async () => {
      await setup();
      const items = columnOrderItems();

      fire(items[0], 'dragstart');
      expect(items[0].classList.contains('dragging')).toBe(true);

      fire(items[0], 'dragend');
      await flush();

      expect(items[0].classList.contains('dragging')).toBe(false);
      expect(items.some(el => el.classList.contains('none-hover'))).toBe(false);
    });

    it('stops reordering once the drag has ended', async () => {
      const { app } = await setup();
      const before = [...app.store.state.settings.columnOrder];
      const items = columnOrderItems();

      fire(items[0], 'dragstart');
      fire(items[0], 'dragend');
      fire(items[3], 'dragover');
      await wait(120);
      await flush();

      expect(app.store.state.settings.columnOrder).toEqual(before);
    });
  });
});
