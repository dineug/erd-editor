import { html } from '@dineug/r-html';
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
import { AppContext } from '@/components/appContext';
import SchemaSQLOptions, {
  keepSpace,
  SCHEMA_SQL_OPTIONS_ID,
} from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions';
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
import { BracketType, Database } from '@/constants/schema';
import {
  changeDatabaseAction,
  changeDatabaseNameAction,
  changeDDLScriptAction,
} from '@/engine/modules/settings/atom.actions';
import { createI18n } from '@/i18n/translate';

type Segment = {
  label: string;
  pressed: string | null;
  disabled: string | null;
  title: string | null;
};

let mounted: Mounted | null = null;
const apps: AppContext[] = [];

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  apps.splice(0).forEach(app => app.store.destroy());
});

function createApp(database: number = Database.MySQL): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeDatabaseAction({ value: database }));
  apps.push(app);
  return app;
}

type Handlers = {
  onHide?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
};

async function mountPanel(
  app: AppContext,
  {
    tables = [] as string[],
    longNames = [] as string[],
    readonly = false,
    ...handlers
  }: Handlers & {
    tables?: string[];
    longNames?: string[];
    readonly?: boolean;
  } = {}
) {
  mounted = await mountAndFlush(
    html`<${SchemaSQLOptions}
      isDarkMode=${true}
      readonly=${readonly}
      .tables=${tables}
      .longNames=${longNames}
      .onHide=${handlers.onHide ?? (() => {})}
      .onSave=${handlers.onSave ?? (() => {})}
      .onCopy=${handlers.onCopy ?? (() => {})}
    />`,
    app
  );
  return mounted;
}

const panelOf = () =>
  (mounted as Mounted).container.querySelector('aside') as HTMLElement;

const segmentsOf = (labelledBy: string) =>
  Array.from(
    panelOf().querySelectorAll<HTMLButtonElement>(
      `[aria-labelledby="${labelledBy}"] button`
    )
  );

const readSegments = (labelledBy: string): Segment[] =>
  segmentsOf(labelledBy).map(button => ({
    label: button.textContent?.trim() ?? '',
    pressed: button.getAttribute('aria-pressed'),
    disabled: button.getAttribute('aria-disabled'),
    title: button.getAttribute('title') || null,
  }));

const statementsOf = () => readSegments('schema-sql-statements');
const headersOf = () => readSegments('schema-sql-header');

const pressedOf = (segments: Segment[]) =>
  segments.filter(segment => segment.pressed === 'true').map(s => s.label);

const disabledOf = (segments: Segment[]) =>
  segments
    .filter(segment => segment.disabled === 'true')
    .map(segment => [segment.label, segment.title]);

const query = <T extends Element = HTMLElement>(selector: string) =>
  (mounted as Mounted).container.querySelector<T>(selector);

/** The panel for each database at the editor's first intent, if not exists and create and use. */
const DEFAULT_SEGMENTS: Array<
  [number, { statements: string[]; headers: string[]; disabled: string[][] }]
> = [
  [
    Database.MySQL,
    { statements: ['If not exists'], headers: ['CREATE + USE'], disabled: [] },
  ],
  [
    Database.MariaDB,
    { statements: ['If not exists'], headers: ['CREATE + USE'], disabled: [] },
  ],
  [
    Database.PostgreSQL,
    {
      statements: ['If not exists'],
      headers: ['CREATE + USE'],
      disabled: [['USE', 'Not in PostgreSQL']],
    },
  ],
  [
    Database.Oracle,
    {
      statements: ['Create'],
      headers: ['USE'],
      disabled: [
        ['If not exists', 'Not in Oracle'],
        ['CREATE + USE', 'Not in Oracle'],
      ],
    },
  ],
  [
    Database.MSSQL,
    {
      statements: ['Create'],
      headers: ['CREATE + USE'],
      disabled: [['If not exists', 'Not in MSSQL']],
    },
  ],
  [
    Database.SQLite,
    {
      statements: ['If not exists'],
      headers: ['None'],
      disabled: [
        ['USE', 'Not in SQLite'],
        ['CREATE + USE', 'Not in SQLite'],
      ],
    },
  ],
  [
    Database.Snowflake,
    {
      statements: ['Create'],
      headers: ['CREATE + USE'],
      disabled: [['If not exists', 'Not in Snowflake']],
    },
  ],
  [
    Database.Databricks,
    { statements: ['If not exists'], headers: ['CREATE + USE'], disabled: [] },
  ],
];

describe('SchemaSQLOptions', () => {
  it('heads the panel with Schema SQL and a Hide options button that controls it', async () => {
    const onHide = vi.fn();
    await mountPanel(createApp(), { onHide });

    const panel = panelOf();
    const hide = query<HTMLButtonElement>('.schema-sql-options-hide')!;
    expect(panel.id).toBe(SCHEMA_SQL_OPTIONS_ID);
    expect(
      panel.querySelector(`#${panel.getAttribute('aria-labelledby')}`)
        ?.textContent
    ).toBe('Schema SQL');
    expect(hide.getAttribute('aria-label')).toBe('Hide options');
    expect(hide.getAttribute('title')).toBe('Hide options');
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(hide.getAttribute('aria-controls')).toBe(SCHEMA_SQL_OPTIONS_ID);

    hide.click();
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('groups what the document saves apart from what this window keeps', async () => {
    await mountPanel(createApp());

    const groups = Array.from(panelOf().querySelectorAll('[role="group"]'))
      .filter(group => group.tagName === 'SECTION')
      .map(group => group.getAttribute('aria-label'));
    expect(groups).toEqual([
      'Saved in the document',
      'This window only',
      'Saved in the document · written as is for every database',
    ]);
    expect(panelOf().textContent).toContain(
      'MSSQL gets GO after a script that does not end with GO.'
    );
  });

  for (const [database, expected] of DEFAULT_SEGMENTS) {
    it(`presses what database ${database} writes for the first intent, the rest it lacks dimmed`, async () => {
      await mountPanel(createApp(database));

      expect(pressedOf(statementsOf())).toEqual(expected.statements);
      expect(pressedOf(headersOf())).toEqual(expected.headers);
      expect([
        ...disabledOf(statementsOf()),
        ...disabledOf(headersOf()),
      ]).toEqual(expected.disabled);
    });
  }

  it("names the statements and the headers as written, None in the reader's language", async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);

    try {
      await mountPanel(createApp());
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();

      expect(statementsOf().map(s => s.label)).toEqual([
        'Create',
        'If not exists',
        'Drop & re-create',
      ]);
      expect(headersOf().map(s => s.label)).toEqual([
        'ko:None',
        'USE',
        'CREATE + USE',
      ]);
      expect(panelOf().dir).toBe('ltr');
    } finally {
      provider.destroy();
    }
  });

  it("titles SQL Server's drop and re-create with its first release, and each header with its SQL", async () => {
    await mountPanel(createApp(Database.MSSQL));

    expect(statementsOf().map(s => s.title)).toEqual([
      null,
      'Not in MSSQL',
      'SQL Server 2016+',
    ]);
    expect(headersOf().map(s => s.title)).toEqual([
      null,
      'USE',
      'CREATE DATABASE + USE',
    ]);
  });

  it("keeps the window's pick, which outlives a database lacking it", async () => {
    const app = createApp();
    await mountPanel(app);
    const view = schemaSQLViewOf(app);

    segmentsOf('schema-sql-statements')[2].click();
    segmentsOf('schema-sql-header')[1].click();
    await flush();
    expect([view.statements, view.header]).toEqual(['recreate', 'use']);
    expect(pressedOf(headersOf())).toEqual(['USE']);

    app.store.dispatchSync(changeDatabaseAction({ value: Database.SQLite }));
    await flush();
    expect(pressedOf(headersOf())).toEqual(['None']);

    app.store.dispatchSync(changeDatabaseAction({ value: Database.MySQL }));
    await flush();
    expect(pressedOf(headersOf())).toEqual(['USE']);
  });

  it('ignores a press on a choice the database lacks, which still takes the focus', async () => {
    const app = createApp(Database.Oracle);
    await mountPanel(app);
    const view = schemaSQLViewOf(app);
    view.statements = 'create';

    const ifNotExists = segmentsOf('schema-sql-statements')[1];
    ifNotExists.click();
    await flush();

    expect(view.statements).toBe('create');
    expect(ifNotExists.disabled).toBe(false);
  });

  it('warns what a drop and re-create takes, only then and only with tables', async () => {
    const app = createApp();
    await mountPanel(app, { tables: ['member', 'post'] });
    const warning = () => query('.schema-sql-options-warning');
    expect(warning()).toBeNull();

    schemaSQLViewOf(app).statements = 'recreate';
    await flush();

    expect(warning()?.getAttribute('role')).toBe('note');
    expect(warning()?.textContent).toBe(
      'Drops member and post before creating them. Their rows are lost.'
    );
    expect(warning()?.querySelector('[aria-hidden="true"] svg')).not.toBeNull();

    app.store.dispatchSync(changeDatabaseAction({ value: Database.Snowflake }));
    await flush();
    expect(warning()?.textContent).toBe(
      'Replaces member and post. Their rows are lost.'
    );
  });

  it('warns of nothing with no table to drop', async () => {
    const app = createApp();
    schemaSQLViewOf(app).statements = 'recreate';
    await mountPanel(app);

    expect(query('.schema-sql-options-warning')).toBeNull();
  });

  it('says why no header is written, for an empty name as for an invalid one', async () => {
    const app = createApp();
    await mountPanel(app);
    const note = () => query('.schema-sql-options-header-name')?.textContent;

    expect(note()).toBe('Database name "" is not a valid identifier.');

    app.store.dispatchSync(changeDatabaseNameAction({ value: 'my shop' }));
    await flush();
    expect(note()).toBe('Database name "my shop" is not a valid identifier.');

    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    await flush();
    expect(note()).toBeUndefined();

    app.store.dispatchSync(
      changeDatabaseNameAction({ value: '' }),
      changeDatabaseAction({ value: Database.SQLite })
    );
    await flush();
    expect(note()).toBeUndefined();
  });

  it('names the Oracle names over 30 bytes it is handed', async () => {
    await mountPanel(createApp(Database.Oracle), {
      longNames: ['a_very_long_table_name_past_thirty', 'FK_x_TO_y_long'],
    });

    expect(query('.schema-sql-options-long-names')?.textContent).toBe(
      'Oracle 12.2+ for names over 30 bytes: a_very_long_table_name_past_thirty, FK_x_TO_y_long'
    );
  });

  it('picks the database and the bracket the document saves from its lists', async () => {
    const app = createApp();
    await mountPanel(app);
    const database = query<HTMLSelectElement>('#schema-sql-database')!;
    const bracket = query<HTMLSelectElement>('#schema-sql-bracket')!;

    expect(
      Array.from(database.options).map(option => option.textContent)
    ).toEqual([
      'Databricks',
      'MSSQL',
      'MariaDB',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'Snowflake',
      'SQLite',
    ]);
    expect(
      Array.from(bracket.options).map(option => option.textContent)
    ).toEqual(['SingleQuote', 'DoubleQuote', 'Backtick', 'None']);
    expect(database.value).toBe(String(Database.MySQL));
    expect(
      panelOf().querySelector('label[for="schema-sql-database"]')?.textContent
    ).toBe('Database');

    database.value = String(Database.Oracle);
    database.dispatchEvent(new Event('change', { bubbles: true }));
    bracket.value = String(BracketType.backtick);
    bracket.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(app.store.state.settings.database).toBe(Database.Oracle);
    expect(app.store.state.settings.bracketType).toBe(BracketType.backtick);
  });

  it('edits the scripts the document saves, each labelled, one action per edit', async () => {
    const app = createApp();
    app.store.dispatchSync(
      changeDDLScriptAction({ position: 'after', value: 'GRANT ALL;' })
    );
    await mountPanel(app);
    const before = query<HTMLTextAreaElement>('#schema-sql-before')!;
    const after = query<HTMLTextAreaElement>('#schema-sql-after')!;

    expect(before.placeholder).toBe(
      '-- CREATE EXTENSION, CREATE SCHEMA, SET …'
    );
    expect(after.placeholder).toBe('-- GRANT, CREATE VIEW, seed data …');
    expect(after.value).toBe('GRANT ALL;');
    expect(
      panelOf().querySelector('label[for="schema-sql-before"]')?.textContent
    ).toBe('Before tables');

    before.focus();
    before.value = 'SET x = 1;';
    before.dispatchEvent(new Event('input', { bubbles: true }));
    before.blur();
    await flush();

    expect(app.store.state.settings.ddlScripts).toEqual({
      before: 'SET x = 1;',
      after: 'GRANT ALL;',
    });
  });

  it('commits nothing once the element is gone', async () => {
    const app = createApp();
    await mountPanel(app);
    const before = query<HTMLTextAreaElement>('#schema-sql-before')!;
    const dispatched = vi.fn();
    const unsubscribe = app.store.subscribe(dispatched);

    before.focus();
    before.value = 'SET x = 1;';
    before.dispatchEvent(new Event('input', { bubbles: true }));
    app.lifecycle.destroyed = true;
    before.blur();
    await flush();

    expect(dispatched).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps the scripts from typing in a readonly editor', async () => {
    await mountPanel(createApp(), { readonly: true });

    const scripts = [
      query<HTMLTextAreaElement>('#schema-sql-before')!,
      query<HTMLTextAreaElement>('#schema-sql-after')!,
    ];
    expect(scripts.map(script => script.readOnly)).toEqual([true, true]);
    expect(scripts.map(script => script.getAttribute('aria-readonly'))).toEqual(
      ['true', 'true']
    );
  });

  it('saves and copies from its two buttons', async () => {
    const onSave = vi.fn();
    const onCopy = vi.fn();
    await mountPanel(createApp(), { onSave, onCopy });

    const save = query<HTMLButtonElement>('.schema-sql-options-save')!;
    const copy = query<HTMLButtonElement>('.schema-sql-options-copy')!;
    expect(save.textContent?.trim()).toBe('Save file');
    expect(save.querySelector('svg')).not.toBeNull();
    expect(copy.textContent?.trim()).toBe('Copy');

    save.click();
    copy.click();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('focuses Save file when the export path asks, then forgets the ask', async () => {
    const app = createApp();
    schemaSQLViewOf(app).focusSave = true;
    await mountPanel(app);
    const save = query<HTMLButtonElement>('.schema-sql-options-save');

    expect(document.activeElement).toBe(save);
    expect(schemaSQLViewOf(app).focusSave).toBe(false);

    (document.activeElement as HTMLElement).blur();
    schemaSQLViewOf(app).focusSave = true;
    await flush();

    expect(document.activeElement).toBe(save);
    expect(schemaSQLViewOf(app).focusSave).toBe(false);
  });

  it('keeps Space inside the panel from the hand tool, unprevented, and lets other keys by', async () => {
    await mountPanel(createApp());
    const behind = vi.fn();
    (mounted as Mounted).container.addEventListener('keydown', behind);
    const segment = segmentsOf('schema-sql-statements')[0];

    const space = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    const other = new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      bubbles: true,
      cancelable: true,
    });
    segment.dispatchEvent(space);
    segment.dispatchEvent(other);

    expect(space.defaultPrevented).toBe(false);
    expect(behind).toHaveBeenCalledTimes(1);
    expect(behind.mock.calls[0][0]).toBe(other);
  });

  it('stops nothing but Space', () => {
    const stopPropagation = vi.fn();

    keepSpace({ code: 'Enter', stopPropagation } as unknown as KeyboardEvent);
    keepSpace({ code: 'Space', stopPropagation } as unknown as KeyboardEvent);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("gives the native lists the panel's colour scheme", async () => {
    await mountPanel(createApp());

    expect(panelOf().style.getPropertyValue('color-scheme')).toBe('dark');
  });
});
