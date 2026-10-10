// The Schema SQL tab's options panel where its stylesheets are live and a
// real keyboard reaches it: its width and rules, where it folds away, where
// the focus goes, and the Space key the hand tool would otherwise take.

import {
  addCSSHost,
  createRef,
  FC,
  ref,
  render,
  useProvider,
} from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  provideI18n,
} from '@/__test-utils__';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import {
  schemaSQLViewOf,
  showSchemaSQLExport,
} from '@/components/schema-sql/schemaSQLView';
import { themeContext } from '@/components/themeContext';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import type { LocaleCode } from '@/i18n/locales';
import { setExportFileCallback } from '@/utils/file/exportFile';

// The code block's highlighter is a shared worker whose shiki modules the dev
// server would discover mid-run and reload every spec for; plain text will do.
vi.mock('@/services/shiki', () => ({ getShikiService: () => null }));

type Fixture = {
  app: AppContext;
  shadow: ShadowRoot;
  panel: () => HTMLElement | null;
  hide: () => HTMLButtonElement | null;
  show: () => HTMLButtonElement | null;
  save: () => HTMLButtonElement | null;
};

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
  setExportFileCallback(null);
});

/** The part of ErdEditor that reads the keyboard, around the Schema SQL tab. */
const Editor: FC = (_, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const handleKeydown = (event: KeyboardEvent) => {
    app.value.keydown$.next(event);
  };

  return () => (
    <div
      class="root"
      use:ref={ref(root)}
      tabindex="-1"
      style={{ width: '100%', height: '100%' }}
      on:keydown={handleKeydown}
    >
      <SchemaSQL isDarkMode={true} />
    </div>
  );
};

/** A table with one column, so the DDL writes it and a drop names it. */
function seedTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
    changeTableNameAction({ id, value: name })
  );
  app.store.dispatchSync(addColumnAction({ tableId: id, id: `${id}-col` }));
}

/**
 * Mounts the tab in a shadow root as the element has one, the editor measured
 * at the width given, after whatever the case sets on the store first, in the
 * language given or English.
 */
async function setup(
  width = 1000,
  before: (app: AppContext) => void = () => {},
  locale: LocaleCode = 'en'
): Promise<Fixture> {
  const app = createTestAppContext();
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  container.setAttribute(
    'style',
    `position: relative; width: ${width}px; height: 700px;`
  );
  shadow.append(globals, container);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the casts; it is r-html's own, not a React hook.
  const providers = [
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, appContext, app),
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, themeContext, createTestTheme()),
    provideI18n(container, createTestI18n(locale)),
  ];
  app.store.dispatchSync(changeViewportAction({ width, height: 700 }));
  before(app);
  render(globals, <GlobalStyles />);
  render(container, <Editor />);
  await flush();

  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    providers.forEach(provider => provider.destroy());
    host.remove();
    app.store.destroy();
  });

  return {
    app,
    shadow,
    panel: () => shadow.querySelector<HTMLElement>('aside.schema-sql-options'),
    hide: () =>
      shadow.querySelector<HTMLButtonElement>('.schema-sql-options-hide'),
    show: () =>
      shadow.querySelector<HTMLButtonElement>('.schema-sql-options-show'),
    save: () =>
      shadow.querySelector<HTMLButtonElement>('.schema-sql-options-save'),
  };
}

describe('the Schema SQL options panel on a real layout', () => {
  it('stands 300 px wide at the right of the code, which takes the rest', async () => {
    const fixture = await setup(1000);
    const panel = fixture.panel()!.getBoundingClientRect();
    const code = (
      fixture.shadow.querySelector('.root > div > div') as HTMLElement
    ).getBoundingClientRect();

    expect(panel.width).toBe(300);
    expect(code.width).toBe(700);
    expect(panel.left).toBe(code.right);
  });

  it('draws its rule between the code and itself in a right-to-left language too', async () => {
    const fixture = await setup(1000, undefined, 'ar-SA');
    const panel = fixture.panel()!;
    // the theme's colour, which this mount leaves unset, the rule drawn in
    panel.style.setProperty('--context-menu-border', '#ccc');
    const code = (
      fixture.shadow.querySelector('.root > div > div') as HTMLElement
    ).getBoundingClientRect();
    const style = getComputedStyle(panel);

    expect(panel.dir).toBe('rtl');
    expect(panel.getBoundingClientRect().left).toBe(code.right);
    expect([style.borderLeftWidth, style.borderRightWidth]).toEqual([
      '1px',
      '0px',
    ]);
  });

  it.each(['en', 'ar-SA'] as const)(
    '%s: sets each list 132 px wide beside its name, its chevron at the list end',
    async locale => {
      const fixture = await setup(1000, undefined, locale);
      const panel = fixture.panel()!;
      const rtl = locale === 'ar-SA';

      for (const id of ['schema-sql-database', 'schema-sql-bracket']) {
        const select = panel.querySelector<HTMLSelectElement>(`#${id}`)!;
        const list = select.getBoundingClientRect();
        const name = panel
          .querySelector(`label[for="${id}"]`)!
          .getBoundingClientRect();
        const chevron = select
          .parentElement!.querySelector('svg')!
          .getBoundingClientRect();
        const middle = list.left + list.width / 2;

        expect(getComputedStyle(select).direction).toBe(rtl ? 'rtl' : 'ltr');
        expect(list.width).toBe(132);
        expect(rtl ? name.left > list.right : name.right < list.left).toBe(
          true
        );
        expect(chevron.left).toBeGreaterThan(list.left);
        expect(chevron.right).toBeLessThan(list.right);
        expect(rtl ? chevron.right < middle : chevron.left > middle).toBe(true);
      }
    }
  );

  it('draws a 1 px rule halfway into the gap above each group but the first', async () => {
    const fixture = await setup();
    const groups = Array.from(
      fixture.panel()!.querySelectorAll('section')
    ) as HTMLElement[];

    const rules = groups.map(group => getComputedStyle(group, '::before'));
    expect(rules.map(rule => rule.content)).toEqual(['none', '""', '""']);
    for (const rule of rules.slice(1)) {
      expect(rule.top).toBe('-8.5px');
      expect(rule.height).toBe('1px');
    }
    const gap =
      groups[1].getBoundingClientRect().top -
      groups[0].getBoundingClientRect().bottom;
    expect(gap).toBe(16);
  });

  it('opens from 640 px of editor and folds away below, Show options over the code instead', async () => {
    const wide = await setup(640);
    expect(wide.panel()).not.toBeNull();
    expect(wide.show()).toBeNull();

    const narrow = await setup(639);
    expect(narrow.panel()).toBeNull();
    const show = narrow.show()!.getBoundingClientRect();
    expect(show.width).toBe(26);
    expect(show.right).toBeLessThanOrEqual(639 - 8);
  });

  it('keeps the place it was left in while the editor narrows', async () => {
    const fixture = await setup(1000);

    fixture.app.store.dispatchSync(
      changeViewportAction({ width: 500, height: 700 })
    );
    await flush();

    expect(fixture.panel()).not.toBeNull();
  });

  it('hands the focus to Show options as it folds, and to Hide options as it opens', async () => {
    const fixture = await setup();

    fixture.hide()!.click();
    await flush();
    expect(fixture.panel()).toBeNull();
    expect(fixture.shadow.activeElement).toBe(fixture.show());

    fixture.show()!.click();
    await flush();
    expect(fixture.panel()).not.toBeNull();
    expect(fixture.shadow.activeElement).toBe(fixture.hide());
  });

  it('focuses Save file when the export path opens it, on a narrow editor too', async () => {
    const fixture = await setup(500, app => showSchemaSQLExport(app));

    expect(fixture.panel()).not.toBeNull();
    expect(fixture.shadow.activeElement).toBe(fixture.save());
    expect(schemaSQLViewOf(fixture.app).focusSave).toBe(false);
  });
});

describe('the drop warning on a real layout', () => {
  /** The warning box, its text and its icon, with tables named as given, Drop & re-create chosen. */
  async function warningFor(names: string[]) {
    const fixture = await setup(1000, app => {
      names.forEach((name, index) => seedTable(app, `t${index}`, name));
      schemaSQLViewOf(app).statements = 'recreate';
    });
    const box = fixture.shadow.querySelector<HTMLElement>(
      '.schema-sql-options-warning'
    )!;

    return {
      box: box.getBoundingClientRect(),
      text: box.querySelector('span')!.getBoundingClientRect(),
      icon: box.querySelector('svg')!.getBoundingClientRect(),
    };
  }

  it('breaks a table name too long for a line inside its box', async () => {
    const { box, text } = await warningFor([
      'customer_order_item_shipping_addresses_by_region',
      'member',
    ]);

    expect(text.right).toBeLessThanOrEqual(box.right - 10);
    expect(text.left).toBeGreaterThanOrEqual(box.left + 10);
  });

  it('sets the icon beside the first line of a warning of several', async () => {
    const { box, text, icon } = await warningFor([
      'customer_order_item_shipping_addresses_by_region',
      'member',
      'post',
    ]);

    expect(text.height).toBeGreaterThanOrEqual(3 * 16);
    expect(icon.top - (box.top + 8)).toBe(1);
  });
});

describe('the Schema SQL options panel on a real keyboard', () => {
  it('presses a segment with Space, which the hand tool never takes', async () => {
    const fixture = await setup();
    const recreate = Array.from(
      fixture
        .panel()!
        .querySelectorAll<HTMLButtonElement>(
          '[aria-labelledby="schema-sql-statements"] button'
        )
    )[2];
    recreate.focus();

    await userEvent.keyboard(' ');
    await flush();

    expect(recreate.getAttribute('aria-pressed')).toBe('true');
    expect(schemaSQLViewOf(fixture.app).statements).toBe('recreate');
    expect(fixture.app.store.state.editor.handTool).toBe(false);
  });

  it('folds the panel with Space on Hide options and opens it with Space on Show options', async () => {
    const fixture = await setup();
    fixture.hide()!.focus();

    await userEvent.keyboard(' ');
    await flush();
    expect(fixture.panel()).toBeNull();
    expect(fixture.shadow.activeElement).toBe(fixture.show());

    await userEvent.keyboard(' ');
    await flush();
    expect(fixture.panel()).not.toBeNull();
    expect(fixture.app.store.state.editor.handTool).toBe(false);
  });

  it('saves the file once with Space on Save file', async () => {
    const saved = vi.fn();
    setExportFileCallback(saved);
    const fixture = await setup();
    fixture.save()!.focus();

    await userEvent.keyboard(' ');
    await flush();

    expect(saved).toHaveBeenCalledTimes(1);
    expect(fixture.app.store.state.editor.handTool).toBe(false);
  });
});
