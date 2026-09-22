import type { RootState } from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { comparable, settle } from '@/__test-utils__/mcp';
import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import {
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
      expect(comparable(other.value)).toEqual(comparable(agent.value));
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

  it('takes the settings the JSON document carries', async () => {
    const session = open();
    await quiet();

    runTool(session.agent, 'erd_import_json', TOOL_SCENARIOS.erd_import_json);
    await quiet();

    expect(session.agent.state.settings.databaseName).toBe('imported');
    expect(session.other.state.settings.databaseName).toBe('imported');
  });

  it('brings the seed back on both sides with one undo', async () => {
    const session = open();
    await quiet();
    const { agent, other } = session;

    runTool(agent, 'erd_import_sql', TOOL_SCENARIOS.erd_import_sql);
    agent.undo();
    await quiet();

    expect(tableNames(agent.state)).toEqual(['users', 'orders', 'empty']);
    expect(other.state.doc.indexIds).toEqual([SEED.index]);
    expect(comparable(other.value)).toEqual(comparable(agent.value));
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

  it('loads an empty text as an empty document, as the element’s value setter does', async () => {
    const session = open();
    await quiet();

    const run = runTool(session.agent, 'erd_import_json', { value: '' });
    await quiet();

    // The reducer cannot parse an empty text; an empty object is a document.
    expect(
      run.actions.find(({ type }) => type === 'editor.loadJson')?.payload
    ).toEqual({ value: '{}' });
    expect(run.batches).toBe(1);
    expect(session.agent.state.doc.tableIds).toEqual([]);
    expect(session.other.state.doc.tableIds).toEqual([]);
  });
});
