// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import {
  comparable,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import type { RootState } from '@/engine/state';

const sessions: Session[] = [];

function open(options?: Parameters<typeof createSession>[0]) {
  const session = createSession(options);
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

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('the call was accepted');
    },
    (error: unknown) => error as AgentToolError
  );

describe('an import replaces the document on both sides (AC-E13)', () => {
  it.each([...SCHEMA_IMPORTS, ['erd_import_json', 'accounts']] as const)(
    '%s loads %s in place of the seed and sends the load to the user side',
    async (name, table) => {
      const session = open();
      await settle();
      const { peer, user } = session;

      const run = await peer.runTool(name, TOOL_SCENARIOS[name]);
      await settle();

      const sent = session.sent
        .filter(actions =>
          actions.some(({ type }) => type === 'editor.loadJson')
        )
        .map(actions => actions.map(({ type }) => type));

      expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
      expect(run.mismatch).toBeUndefined();
      expect(sent).toHaveLength(1);
      expect(sent[0].slice(0, 2)).toEqual(['editor.clear', 'editor.loadJson']);
      expect(tableNames(peer.state)).toEqual([table]);
      expect(tableNames(user.rxStore.state)).toEqual([table]);
      expect(peer.state.doc).toMatchObject({
        relationshipIds: [],
        indexIds: [],
        memoIds: [],
      });
      expect(comparable(toJson(user.rxStore.state))).toEqual(
        comparable(peer.value)
      );
    }
  );

  it.each(SCHEMA_IMPORTS)(
    '%s keeps the settings and lays the tables out in the same batch',
    async name => {
      const session = open();
      await settle();
      const { peer } = session;
      await peer.runTool('erd_set_database_name', { value: 'shop' });

      await peer.runTool(name, TOOL_SCENARIOS[name]);

      expect(peer.state.settings.databaseName).toBe('shop');
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
    await settle();

    await session.peer.runTool(
      'erd_import_json',
      TOOL_SCENARIOS.erd_import_json
    );
    await settle();

    expect(session.peer.state.settings.databaseName).toBe('imported');
    expect(session.user.rxStore.state.settings.databaseName).toBe('imported');
  });

  it('brings the seed back on both sides with one undo', async () => {
    const session = open();
    await settle();
    const { peer, user } = session;

    await peer.runTool('erd_import_sql', TOOL_SCENARIOS.erd_import_sql);
    await peer.undo();
    await settle();

    expect(tableNames(peer.state)).toEqual(['users', 'orders', 'empty']);
    expect(user.rxStore.state.doc.indexIds).toEqual([SEED.index]);
    expect(comparable(toJson(user.rxStore.state))).toEqual(
      comparable(peer.value)
    );
  });

  it('lays tables out at the same points where the user side measures text apart', async () => {
    const session = open({
      userToWidth: text => Math.round(text.length * 6.5) + 2,
    });
    await settle();
    const { peer, user } = session;
    const positions = ({ doc, collections }: RootState) =>
      doc.tableIds.map(id => {
        const { name, ui } = collections.tableEntities[id];
        return [name, ui.x, ui.y];
      });

    await peer.runTool('erd_import_sql', {
      value: [
        'CREATE TABLE a_table_with_a_rather_long_name (id INT PRIMARY KEY, a_column_with_a_long_name TEXT);',
        'CREATE TABLE b (id INT PRIMARY KEY);',
        'CREATE TABLE c_also_named_at_some_length (id INT PRIMARY KEY, x INT, y INT);',
        'CREATE TABLE d (id INT PRIMARY KEY);',
      ].join('\n'),
    });
    await settle();

    const widths = ({ doc, collections }: RootState) =>
      doc.tableIds.map(id => collections.tableEntities[id].ui.widthName);

    expect(positions(peer.state)).toHaveLength(4);
    expect(widths(user.rxStore.state)).not.toEqual(widths(peer.state));
    expect(positions(user.rxStore.state)).toEqual(positions(peer.state));
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
      await settle();
      const sentBefore = session.sent.length;

      const error = await refusal(session.peer.runTool(name, { value }));
      await settle();

      expect(error.code).toBe(AgentToolErrorCode.invalidArgs);
      expect(error.message).toBe('value is empty, so nothing was imported');
      expect(session.sent).toHaveLength(sentBefore);
      expect(tableNames(session.peer.state)).toEqual([
        'users',
        'orders',
        'empty',
      ]);
    }
  );

  it('still imports a text that blank lines and spaces pad', async () => {
    const session = open();

    const run = await session.peer.runTool('erd_import_sql', {
      value: '\n\n  CREATE TABLE accounts (id INT PRIMARY KEY);  \n',
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(tableNames(session.peer.state)).toEqual(['accounts']);
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
      await settle();
      const sentBefore = session.sent.length;

      const error = await refusal(
        session.peer.runTool('erd_import_json', { value })
      );

      expect(error.code).toBe(AgentToolErrorCode.invalidArgs);
      expect(error.message.startsWith(message)).toBe(true);
      expect(session.sent).toHaveLength(sentBefore);
      expect(session.peer.state.doc.tableIds).toHaveLength(3);
    }
  );

  it('loads an empty text as an empty document, as the element’s value setter does', async () => {
    const session = open();
    await settle();

    const run = await session.peer.runTool('erd_import_json', { value: '' });
    await settle();

    // The reducer cannot parse an empty text; an empty object is a document.
    expect(
      run.actions.find(({ type }) => type === 'editor.loadJson')?.payload
    ).toEqual({ value: '{}' });
    expect(run.batches).toBe(1);
    expect(session.peer.state.doc.tableIds).toEqual([]);
    expect(session.user.rxStore.state.doc.tableIds).toEqual([]);
  });
});
