import {
  getTablesGroupRect,
  LockSettingType,
  type RootState,
  settingsActions,
  settingsActions$,
} from '@dineug/erd-editor/peer.js';
import { createSchema, toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { settle } from '@/__test-utils__/mcp';
import { APPEND_SCENARIOS, TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import {
  createImportValue,
  createPeerSession,
  type PeerSession,
  SEED,
} from '@/__test-utils__/seed';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { runTool } from '@/tools/run';

const sessions: PeerSession[] = [];

/** The hooks a load or an edit schedules land on timers of a few milliseconds. */
const quiet = () => settle(30);

function open(options?: Parameters<typeof createPeerSession>[0]) {
  const session = createPeerSession(options);
  sessions.push(session);
  return session;
}

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

const tableNames = ({ doc, collections }: RootState) =>
  doc.tableIds.map(id => collections.tableEntities[id].name);

/** Each schema import and the one table its scenario text declares. */
const SCHEMA_IMPORTS: Array<[string, string]> = [
  ['erd_import_sql', 'accounts'],
  ['erd_import_graphql', 'Account'],
  ['erd_import_dbml', 'accounts'],
  ['erd_import_aml', 'accounts'],
];

function refusal(call: () => unknown): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the call was accepted');
}

describe('an import replaces the document on both sides (AC-E13)', () => {
  it.each([...SCHEMA_IMPORTS, ['erd_import_json', 'accounts']] as const)(
    '%s loads %s in place of the seed and sends the load to the other side',
    async (name, table) => {
      const session = open();
      await quiet();
      const { agent, other } = session;

      const run = runTool(agent, name, TOOL_SCENARIOS[name]);
      await quiet();

      const sent = session.sent
        .filter(actions =>
          actions.some(({ type }) => type === 'editor.loadJson')
        )
        .map(actions => actions.map(({ type }) => type));

      expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
      expect(run.mismatch).toBeUndefined();
      expect(sent).toHaveLength(1);
      expect(sent[0].slice(0, 2)).toEqual(['editor.clear', 'editor.loadJson']);
      expect(tableNames(agent.state)).toEqual([table]);
      expect(tableNames(other.state)).toEqual([table]);
      expect(agent.state.doc).toMatchObject({
        relationshipIds: [],
        indexIds: [],
        memoIds: [],
      });
      expect(JSON.parse(other.value)).toEqual(JSON.parse(agent.value));
    }
  );

  it.each(SCHEMA_IMPORTS)(
    '%s keeps the settings and lays the tables out in the same batch',
    async name => {
      const session = open();
      await quiet();
      const { agent } = session;
      runTool(agent, 'erd_set_database_name', { value: 'shop' });

      runTool(agent, name, TOOL_SCENARIOS[name]);

      expect(agent.state.settings.databaseName).toBe('shop');
      expect(
        session.sent
          .find(actions =>
            actions.some(({ type }) => type === 'editor.loadJson')
          )
          ?.at(-1)?.type
      ).toBe('table.sort');
    }
  );

  it.each(SCHEMA_IMPORTS)(
    '%s puts the view at the start of the canvas, in the file too, though a lock held it',
    async name => {
      const session = open();
      await quiet();
      const { agent, other } = session;
      const viewOf = (value: string) => {
        const { originX, originY, zoomLevel } = JSON.parse(value).settings;
        return { originX, originY, zoomLevel };
      };
      const { originX, originY, zoomLevel } = createSchema().settings;
      const start = { originX, originY, zoomLevel };
      agent.dispatch([
        settingsActions$.changeLockSettingsAction$(
          LockSettingType.viewport,
          false
        ),
      ]);
      agent.dispatch([settingsActions.changeZoomLevelAction({ value: 0.5 })]);
      agent.dispatch([
        settingsActions$.changeLockSettingsAction$(
          LockSettingType.viewport,
          true
        ),
      ]);
      await quiet();
      expect(viewOf(agent.value)).not.toEqual(start);

      runTool(agent, name, TOOL_SCENARIOS[name]);
      await quiet();

      expect(viewOf(agent.value)).toEqual(start);
      expect(viewOf(other.value)).toEqual(start);
      expect(agent.state.settings.lockSettings).toBe(63);
    }
  );

  it('takes the settings the JSON document carries', async () => {
    const session = open();
    await quiet();

    runTool(session.agent, 'erd_import_json', TOOL_SCENARIOS.erd_import_json);
    await quiet();

    expect(session.agent.state.settings.databaseName).toBe('imported');
    expect(session.other.state.settings.databaseName).toBe('imported');
  });

  it.each([
    ['carries', LockSettingType.language, 63 & ~LockSettingType.language, 0.8],
    ['has no', undefined, 63, createSchema().settings.zoomLevel],
  ])(
    'takes the locks of a JSON document that %s lockSettings, every one on and the view at the start without them',
    async (_, unlocked, locks, zoomLevel) => {
      const session = open();
      await quiet();
      const { agent, other } = session;
      agent.dispatch([
        settingsActions$.changeLockSettingsAction$(
          LockSettingType.viewport | LockSettingType.bracketType,
          false
        ),
      ]);
      agent.dispatch([settingsActions.changeZoomLevelAction({ value: 0.5 })]);
      const json = JSON.parse(createImportValue());
      json.settings.zoomLevel = 0.8;
      if (unlocked === undefined) {
        delete json.settings.lockSettings;
      } else {
        json.settings.lockSettings &= ~unlocked;
      }

      runTool(agent, 'erd_import_json', { value: JSON.stringify(json) });
      await quiet();

      expect(agent.state.settings.lockSettings).toBe(locks);
      expect(other.state.settings.lockSettings).toBe(locks);
      expect(agent.state.settings.zoomLevel).toBe(zoomLevel);
    }
  );

  it('brings the seed back on both sides with one undo', async () => {
    const session = open();
    await quiet();
    const { agent, other } = session;

    runTool(agent, 'erd_import_sql', TOOL_SCENARIOS.erd_import_sql);
    agent.undo();
    await quiet();

    expect(tableNames(agent.state)).toEqual(['users', 'orders', 'empty']);
    expect(other.state.doc.indexIds).toEqual([SEED.index]);
    expect(JSON.parse(other.value)).toEqual(JSON.parse(agent.value));
  });

  it('lays tables out at the same points where the other side measures text apart', async () => {
    const session = open({
      otherToWidth: text => Math.round(text.length * 6.5) + 2,
    });
    await quiet();
    const { agent, other } = session;
    const positions = ({ doc, collections }: RootState) =>
      doc.tableIds.map(id => {
        const { name, ui } = collections.tableEntities[id];
        return [name, ui.x, ui.y];
      });

    runTool(agent, 'erd_import_sql', {
      value: [
        'CREATE TABLE a_table_with_a_rather_long_name (id INT PRIMARY KEY, a_column_with_a_long_name TEXT);',
        'CREATE TABLE b (id INT PRIMARY KEY);',
        'CREATE TABLE c_also_named_at_some_length (id INT PRIMARY KEY, x INT, y INT);',
        'CREATE TABLE d (id INT PRIMARY KEY);',
      ].join('\n'),
    });
    await quiet();

    const widths = ({ doc, collections }: RootState) =>
      doc.tableIds.map(id => collections.tableEntities[id].ui.widthName);

    expect(positions(agent.state)).toHaveLength(4);
    expect(widths(other.state)).not.toEqual(widths(agent.state));
    expect(positions(other.state)).toEqual(positions(agent.state));
  });
});

describe('a DBML TableGroup', () => {
  it.each(['replace', 'append'] as const)(
    'erd_import_dbml with mode %s makes a TableGroup a table group round its tables on both sides',
    async mode => {
      const session = open();
      await quiet();
      const { agent, other } = session;
      const value = `Table accounts {
  id int [pk]
}
Table invoices {
  id int [pk]
  account_id int [ref: > accounts.id]
}
Table notes {
  id int [pk]
}
TableGroup billing [color: #3498db, note: 'dropped'] {
  accounts
  invoices
}`;

      const run = runTool(agent, 'erd_import_dbml', { value, mode });
      await quiet();

      const { doc, collections } = agent.state;
      const groupId = doc.tableGroupIds.at(-1)!;
      const group = collections.tableGroupEntities[groupId];
      const memberIds = doc.tableIds.filter(
        id => collections.tableEntities[id].groupId === groupId
      );
      const { x, y, width, height } = group.ui;
      expect(run.mismatch).toBeUndefined();
      expect(group).toMatchObject({ name: 'billing', color: '#3498db' });
      expect(
        memberIds.map(id => collections.tableEntities[id].name).sort()
      ).toEqual(['accounts', 'invoices']);
      expect({ x, y, width, height }).toEqual(
        getTablesGroupRect(agent.state, memberIds)
      );
      expect(doc.tableGroupIds).toHaveLength(mode === 'append' ? 2 : 1);
      expect(JSON.parse(other.value)).toEqual(JSON.parse(agent.value));
    }
  );
});

describe('an import with mode append adds to the document on both sides', () => {
  const SEED_NAMES = ['users', 'orders', 'empty'];

  it.each([...SCHEMA_IMPORTS, ['erd_import_json', 'accounts']] as const)(
    '%s adds %s under new ids beside the seed and sends it to the other side',
    async (name, table) => {
      const session = open();
      await quiet();
      const { agent, other } = session;
      const seeded = structuredClone(agent.state.collections.tableEntities);
      const sentBefore = session.sent.length;

      const run = runTool(agent, name, APPEND_SCENARIOS[name]);
      await quiet();

      const sent = session.sent
        .slice(sentBefore)
        .flatMap(actions => actions.map(({ type }) => type));
      expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
      expect(run.mismatch).toBeUndefined();
      expect(tableNames(agent.state)).toEqual([...SEED_NAMES, table]);
      expect(tableNames(other.state)).toEqual([...SEED_NAMES, table]);
      expect(agent.state.doc.tableIds).not.toContain('accounts');
      expect(run.createdIds).toContain(agent.state.doc.tableIds[3]);
      for (const id of [SEED.users, SEED.orders, SEED.empty]) {
        expect(agent.state.collections.tableEntities[id].ui).toMatchObject({
          x: seeded[id].ui.x,
          y: seeded[id].ui.y,
        });
      }
      expect(agent.state.doc.relationshipIds).toEqual([SEED.relationship]);
      expect(sent).not.toContain('editor.loadJson');
      expect(sent.filter(type => type.startsWith('editor.'))).toEqual([]);
      expect(JSON.parse(other.value)).toEqual(JSON.parse(agent.value));
    }
  );

  it('keeps the settings, the database name the document carries included', async () => {
    const session = open();
    await quiet();
    runTool(session.agent, 'erd_set_database_name', { value: 'shop' });

    runTool(session.agent, 'erd_import_json', APPEND_SCENARIOS.erd_import_json);
    await quiet();

    expect(session.agent.state.settings.databaseName).toBe('shop');
    expect(session.other.state.settings.databaseName).toBe('shop');
  });

  it('lays what it adds out below every table and memo the seed holds, from the left edge of its group', async () => {
    const session = open();
    await quiet();
    const { agent } = session;
    const { tableEntities, memoEntities, tableGroupEntities } =
      agent.state.collections;
    const lowest = Math.max(
      ...Object.values(tableEntities).map(({ ui }) => ui.y),
      ...Object.values(memoEntities).map(({ ui }) => ui.y)
    );

    runTool(agent, 'erd_import_sql', APPEND_SCENARIOS.erd_import_sql);

    const added =
      agent.state.collections.tableEntities[agent.state.doc.tableIds[3]];
    expect(added.ui.y).toBeGreaterThan(lowest);
    expect(added.ui.x).toBe(tableGroupEntities[SEED.group].ui.x);
  });

  it('takes the append away on both sides with one undo', async () => {
    const session = open();
    await quiet();
    const { agent, other } = session;

    runTool(agent, 'erd_import_dbml', APPEND_SCENARIOS.erd_import_dbml);
    agent.undo();
    await quiet();

    expect(tableNames(agent.state)).toEqual(SEED_NAMES);
    expect(tableNames(other.state)).toEqual(SEED_NAMES);
    expect(JSON.parse(other.value)).toEqual(JSON.parse(agent.value));
  });

  it('refuses an empty document text, which would add nothing', async () => {
    const session = open();
    await quiet();
    const sentBefore = session.sent.length;

    const error = refusal(() =>
      runTool(session.agent, 'erd_import_json', { value: '', mode: 'append' })
    );

    expect(error.code).toBe(ToolErrorCode.invalidArgs);
    expect(error.message).toBe('value is empty, so nothing was imported');
    expect(session.sent).toHaveLength(sentBefore);
  });
});

describe('what an import refuses or mirrors from the element', () => {
  it.each(
    SCHEMA_IMPORTS.flatMap(([name]) =>
      ['', '\n', '   \n  '].map(value => [name, value] as const)
    )
  )(
    '%s refuses the text %j, which the element’s setter trims and skips',
    async (name, value) => {
      const session = open();
      await quiet();
      const sentBefore = session.sent.length;

      const error = refusal(() => runTool(session.agent, name, { value }));
      await quiet();

      expect(error.code).toBe(ToolErrorCode.invalidArgs);
      expect(error.message).toBe('value is empty, so nothing was imported');
      expect(session.sent).toHaveLength(sentBefore);
      expect(tableNames(session.agent.state)).toEqual([
        'users',
        'orders',
        'empty',
      ]);
    }
  );

  it('still imports a text that blank lines and spaces pad', () => {
    const session = open();

    const run = runTool(session.agent, 'erd_import_sql', {
      value: '\n\n  CREATE TABLE accounts (id INT PRIMARY KEY);  \n',
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(tableNames(session.agent.state)).toEqual(['accounts']);
  });

  it.each([
    ['{"version": "3.0.0",', 'value is not an erd-editor document: '],
    ['[]', 'value must be a JSON object, an erd-editor document'],
    ['3', 'value must be a JSON object, an erd-editor document'],
    ['null', 'value must be a JSON object, an erd-editor document'],
  ])(
    'refuses %s as a document before anything is sent',
    async (value, message) => {
      const session = open();
      await quiet();
      const sentBefore = session.sent.length;

      const error = refusal(() =>
        runTool(session.agent, 'erd_import_json', { value })
      );

      expect(error.code).toBe(ToolErrorCode.invalidArgs);
      expect(error.message.startsWith(message)).toBe(true);
      expect(session.sent).toHaveLength(sentBefore);
      expect(session.agent.state.doc.tableIds).toHaveLength(3);
    }
  );

  it('loads an empty text as a new document, as the element’s value setter does', async () => {
    const session = open();
    await quiet();

    const run = runTool(session.agent, 'erd_import_json', { value: '' });
    await quiet();

    // The reducer cannot parse an empty text, so the new document goes spelled out.
    expect(
      run.actions.find(({ type }) => type === 'editor.loadJson')?.payload
    ).toEqual({ value: toJson(createSchema()) });
    expect(run.batches).toBe(1);
    for (const peer of [session.agent, session.other]) {
      expect(peer.state.doc.tableIds).toEqual([]);
      expect(peer.state.settings.lockSettings).toBe(63);
    }
  });
});
