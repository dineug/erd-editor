import { html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import Settings from '@/components/settings/Settings';
import * as styles from '@/components/settings/Settings.styles';
import { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import * as lnbStyles from '@/components/settings/settings-lnb/SettingsLnb.styles';
import { requestSettingsPage } from '@/components/settings/settingsPage';
import * as shortcutsStyles from '@/components/settings/shortcuts/Shortcuts.styles';
import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import {
  BracketType,
  CanvasType,
  ColumnType,
  Language,
  LockSettingType,
} from '@/constants/schema';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeLanguageAction,
  changeMaxWidthCommentAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createI18n } from '@/i18n/translate';
import { fontSize6 } from '@/styles/typography.styles';

let mounted: Mounted | null = null;
let teardown: (() => void) | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  teardown?.();
  teardown = null;
  vi.restoreAllMocks();
});

const root = () =>
  mounted!.container.querySelector(`.${styles.root}`) as HTMLDivElement;

const rows = () =>
  Array.from<HTMLDivElement>(root().querySelectorAll(`.${styles.row}`));

const switchIn = (rowIndex: number) =>
  rows()[rowIndex].querySelector('button') as HTMLButtonElement;

const lockRows = () =>
  Array.from<HTMLDivElement>(root().querySelectorAll(`.${styles.lockRow}`));

const lockName = (row: Element) =>
  row.querySelector(`.${styles.lockName}`)?.textContent?.trim();

const lockValue = (row: Element) =>
  row.querySelector(`.${styles.lockValue}`) as HTMLDivElement;

const lockButton = (row: Element) =>
  row.querySelector('button') as HTMLButtonElement;

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

/** Mounts the tab under a provided language that a spec switches in place. */
async function setupLocalized() {
  const i18n = createTestI18n('en');
  const provider = provideI18n(document.body, i18n);
  teardown = () => provider.destroy();
  return { ...(await setup()), i18n };
}

const switchToPseudo = async (i18n: ReturnType<typeof createTestI18n>) => {
  Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
  await flush();
};

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

    it('renders the three preference rows in order', async () => {
      await setup();

      expect(
        rows().map(row => row.firstElementChild?.textContent?.trim())
      ).toEqual([
        'Relationship DataType Sync',
        'Maximum comment width',
        'Recalculation table width',
      ]);
    });
  });

  describe('a page asked for from outside', () => {
    it('opens on the page asked for before the tab mounted', async () => {
      const app = createTestAppContext();
      requestSettingsPage(app.store, Lnb.shortcuts);

      mounted = await mountAndFlush(html`<${Settings} />`, app);

      expect(heading().textContent?.trim()).toBe(Lnb.shortcuts);
      expect(lnbItems()[1].classList.contains('selected')).toBe(true);
      expect(root().querySelector(`.${shortcutsStyles.table}`)).toBeTruthy();
      expect(root().querySelector(`.${styles.section}`)).toBeNull();
    });

    it('opens on Preferences again the next time the tab mounts', async () => {
      const app = createTestAppContext();
      requestSettingsPage(app.store, Lnb.shortcuts);
      mounted = await mountAndFlush(html`<${Settings} />`, app);
      render(mounted.container, null);

      render(mounted.container, html`<${Settings} />`);
      await flush();

      expect(heading().textContent?.trim()).toBe(Lnb.preferences);
      expect(root().querySelector(`.${styles.section}`)).toBeTruthy();
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

  describe('lock rows', () => {
    const { viewport, canvasType, language, bracketType } = LockSettingType;

    /** A file whose locks are all off, its view and code settings named. */
    async function setupUnlocked() {
      const opened = await setup();
      opened.app.store.dispatchSync(
        initialLoadJsonAction$(
          JSON.stringify({
            version: '3.0.0',
            settings: {
              lockSettings: 0,
              originX: -40.4,
              originY: 90.6,
              zoomLevel: 0.5,
              language: Language.Kotlin,
              bracketType: BracketType.backtick,
            },
          })
        )
      );
      await flush();
      return opened;
    }

    it('lists one row per lock, in the order of the bits', async () => {
      await setup();

      expect(lockRows().map(row => lockName(row))).toEqual([
        'Viewport',
        'Canvas Type',
        'Language',
        'Table Name Case',
        'Column Name Case',
        'Bracket Type',
      ]);
    });

    it('shows every lock of a new document on, at its value', async () => {
      await setup();

      expect(lockRows().map(row => lockValue(row).textContent?.trim())).toEqual(
        ['100% · 0, 0', 'ERD', 'GraphQL', 'Pascal', 'Camel', 'None']
      );
      for (const row of lockRows()) {
        expect(lockButton(row).getAttribute('aria-pressed')).toBe('true');
        expect(lockValue(row).hasAttribute('data-locked')).toBe(true);
      }
      expect(lockButton(lockRows()[0]).title).toBe('Unlock Viewport');
    });

    it('shows the locked value, not the live one', async () => {
      const { app } = await setup();

      app.store.dispatchSync([
        changeZoomLevelAction({ value: 0.5 }),
        scrollToAction({ originX: 300, originY: -20 }),
        changeLanguageAction({ value: Language.Go }),
      ]);
      await flush();

      expect(lockValue(lockRows()[0]).textContent?.trim()).toBe('100% · 0, 0');
      expect(lockValue(lockRows()[2]).textContent?.trim()).toBe('GraphQL');
    });

    it('shows the live value, dimmed, of an unlocked setting', async () => {
      await setupUnlocked();

      const [view, , code, , , bracket] = lockRows();
      expect(lockValue(view).textContent?.trim()).toBe('50% · -40, 91');
      expect(lockValue(code).textContent?.trim()).toBe('Kotlin');
      expect(lockValue(bracket).textContent?.trim()).toBe('Backtick');
      expect(lockValue(view).hasAttribute('data-locked')).toBe(false);
      expect(lockButton(view).getAttribute('aria-pressed')).toBe('false');
      expect(lockButton(view).title).toBe('Lock Viewport');
    });

    it('locks a setting at its value when its button is pressed', async () => {
      const { app } = await setupUnlocked();

      click(lockButton(lockRows()[2]));
      await flush();

      const { lockSettings, lockedValues } = app.store.state.settings;
      expect(lockSettings).toBe(language);
      expect(lockedValues.language).toBe(Language.Kotlin);
      expect(lockButton(lockRows()[2]).getAttribute('aria-pressed')).toBe(
        'true'
      );
    });

    it('locks the origin and the zoom together', async () => {
      const { app } = await setupUnlocked();

      click(lockButton(lockRows()[0]));
      await flush();

      expect(app.store.state.settings.lockSettings).toBe(viewport);
      expect(app.store.state.settings.lockedValues).toMatchObject({
        originX: -40.4,
        originY: 90.6,
        zoomLevel: 0.5,
      });
    });

    it('names and locks the tab the reader came from, never Settings', async () => {
      const { app } = await setupUnlocked();
      app.store.dispatchSync([
        changeCanvasTypeAction({ value: CanvasType.generatorCode }),
        changeCanvasTypeAction({ value: CanvasType.settings }),
      ]);
      await flush();
      expect(lockValue(lockRows()[1]).textContent?.trim()).toBe(
        'Code Generator'
      );

      click(lockButton(lockRows()[1]));
      await flush();

      expect(app.store.state.settings.lockSettings).toBe(canvasType);
      expect(app.store.state.settings.lockedValues.canvasType).toBe(
        CanvasType.generatorCode
      );
      expect(lockValue(lockRows()[1]).textContent?.trim()).toBe(
        'Code Generator'
      );
    });

    it('unlocks one setting alone', async () => {
      const { app } = await setup();

      click(lockButton(lockRows()[5]));
      await flush();

      expect(app.store.state.settings.lockSettings).toBe(63 & ~bracketType);
      expect(lockButton(lockRows()[5]).getAttribute('aria-pressed')).toBe(
        'false'
      );
    });
  });

  describe('display language', () => {
    it('reads every row, heading and title in the language provided, following a switch', async () => {
      const { i18n } = await setupLocalized();
      expect(heading().textContent?.trim()).toBe('Preferences');

      await switchToPseudo(i18n);

      expect(heading().textContent?.trim()).toBe('ko:Preferences');
      expect(
        rows().map(row => row.firstElementChild?.textContent?.trim())
      ).toEqual([
        'ko:Relationship DataType Sync',
        'ko:Maximum comment width',
        'ko:Recalculation table width',
      ]);
      const input = rows()[1].querySelector('input') as HTMLInputElement;
      expect(input.title).toBe('ko:Maximum comment width');
      expect(input.placeholder).toBe('ko:Maximum comment width');
      expect(rows()[2].querySelector('button')?.textContent?.trim()).toBe(
        'ko:Sync'
      );
      expect(
        root()
          .querySelector(`.${styles.lockSection}`)
          ?.firstElementChild?.textContent?.trim()
      ).toBe('ko:Lock');
      expect(
        root()
          .querySelector(`.${styles.columnOrderList}`)
          ?.parentElement?.firstElementChild?.textContent?.trim()
      ).toBe('ko:Column Order');
      expect(columnOrderItems()[0].textContent?.trim()).toBe('ko:Name');
    });

    it('names each lock and its button in one sentence of the language provided', async () => {
      const { app, i18n } = await setupLocalized();
      await switchToPseudo(i18n);

      expect(lockRows().map(row => lockName(row))).toEqual([
        'ko:Viewport',
        'ko:Canvas Type',
        'ko:Language',
        'ko:Table Name Case',
        'ko:Column Name Case',
        'ko:Bracket Type',
      ]);
      expect(lockButton(lockRows()[0]).title).toBe('ko:Unlock ko:Viewport');
      expect(lockValue(lockRows()[0]).title).toBe('ko:Locked value');
      expect(lockValue(lockRows()[1]).textContent?.trim()).toBe('ERD');
      expect(lockValue(lockRows()[5]).textContent?.trim()).toBe('ko:None');

      click(lockButton(lockRows()[0]));
      await flush();

      expect(
        app.store.state.settings.lockSettings & LockSettingType.viewport
      ).toBe(0);
      expect(lockButton(lockRows()[0]).title).toBe('ko:Lock ko:Viewport');
      expect(lockValue(lockRows()[0]).title).toBe('ko:Current value');
    });

    it('wraps a name in isolates inside a right-to-left sentence', async () => {
      const { i18n } = await setupLocalized();
      Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
      await flush();

      expect(lockButton(lockRows()[0]).title).toBe(
        'ar:Unlock \u2068ar:Viewport\u2069'
      );
    });

    it('reads the Shortcuts page name in the language provided', async () => {
      const { i18n } = await setupLocalized();
      await switchToPseudo(i18n);

      click(lnbItems()[1]);
      await flush();

      expect(heading().textContent?.trim()).toBe('ko:Shortcuts');
    });

    it('shows the recalculation toast in the language its container provides', async () => {
      const { app } = await setup();
      const openToast = vi.fn();
      app.emitter.on({ openToast });
      click(rows()[2].querySelector('button') as HTMLButtonElement);
      await flush();

      const toast = document.createElement('div');
      document.body.append(toast);
      const provider = provideI18n(
        toast,
        createTestI18n('ko-KR', pseudoMessages('ko'))
      );
      render(toast, openToast.mock.calls[0][0].payload.message);
      await flush();

      expect(toast.textContent).toContain('ko:Recalculated table width');
      render(toast, null);
      provider.destroy();
      toast.remove();
    });
  });

  describe('text direction', () => {
    it('lets the column order list follow the page, since its rows run down, not across', async () => {
      await setup();

      expect(
        root().querySelector(`.${styles.columnOrderList}`)?.hasAttribute('dir')
      ).toBe(false);
    });

    it('lets each lock value text take its own direction inside a box that keeps the row direction', async () => {
      await setup();

      for (const row of lockRows()) {
        const box = lockValue(row);
        const text = box.querySelector(':scope > span');

        expect(box.hasAttribute('dir')).toBe(false);
        expect(text?.getAttribute('dir')).toBe('auto');
        expect(text?.textContent).toBe(box.textContent);
      }
    });
  });

  describe('maximum comment width', () => {
    it('renders disabled with the minimum width while the setting is -1', async () => {
      const { app } = await setup();

      expect(app.store.state.settings.maxWidthComment).toBe(-1);
      expect(switchIn(1).getAttribute('data-checked')).toBe('false');
      expect(maxWidthInput().disabled).toBe(true);
      expect(maxWidthInput().value).toBe(`${COLUMN_MIN_WIDTH}px`);
    });

    it('enables the input with the column minimum when switched on', async () => {
      const { app } = await setup();

      click(switchIn(1));
      await flush();

      expect(app.store.state.settings.maxWidthComment).toBe(COLUMN_MIN_WIDTH);
      expect(switchIn(1).getAttribute('data-checked')).toBe('true');
      expect(maxWidthInput().disabled).toBe(false);
      expect(maxWidthInput().value).toBe('60px');
    });

    it('disables it again by storing -1 when switched off', async () => {
      const { app } = await setup();
      app.store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      await flush();
      expect(maxWidthInput().value).toBe('120px');

      click(switchIn(1));
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

      const button = rows()[2].querySelector('button') as HTMLButtonElement;
      click(button);
      await flush();

      expect(table.ui.widthName).toBe('a-long-table-name'.length * 10);
    });

    it('emits an openToast action with the confirmation message', async () => {
      const { app } = await setup();
      const openToast = vi.fn();
      app.emitter.on({ openToast });

      click(rows()[2].querySelector('button') as HTMLButtonElement);
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

    it('snaps the held row to its slot and slides only the rows it pushes', async () => {
      await setup();
      // Each row paints at its place in the list, and the flip's second half
      // is held back, so what is read is the invert the reorder commits.
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
          const slot = Array.from(this.parentElement?.children ?? []).indexOf(
            this
          );
          return { top: slot * 32, left: 0 } as DOMRect;
        }
      );
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
      const items = columnOrderItems();

      fire(items[6], 'dragstart');
      fire(items[0], 'dragover');
      await wait(120);
      await flush();

      const [held, ...pushed] = columnOrderItems();
      expect(held).toBe(items[6]);
      expect(held.style.transform).toBe('');
      expect(pushed.map(el => el.style.transform)).toEqual(
        Array(6).fill('translate(0px,-32px)')
      );
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
