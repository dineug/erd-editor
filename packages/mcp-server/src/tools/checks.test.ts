import {
  createPeerStore,
  dictionaryActions,
  type PeerStore,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { MAX_READ_CHARS } from '@/tools/budget';
import { CHECKS_TOOL, toCheckList } from '@/tools/checks';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { checksReader } from '@/tools/read';
import { runTool } from '@/tools/run';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

/**
 * The seed with a forbidden word, a word no dictionary lists and a name the
 * term of its logical name would not give, each on a column of users.
 */
function checkedPeer() {
  const peer = createSeededPeer();
  peers.push(peer);
  runTool(peer, 'erd_update_word', {
    wordId: SEED.numberWord,
    forbiddenWords: 'Num',
  });
  runTool(peer, 'erd_set_column_logical_name', {
    tableId: SEED.users,
    columnId: SEED.userId,
    value: 'Member Number',
  });
  runTool(peer, 'erd_set_column_logical_name', {
    tableId: SEED.users,
    columnId: SEED.userName,
    value: 'Member Num Name',
  });
  return peer;
}

describe('erd_list_checks lists what the dictionaries find', () => {
  it('gives each check its level, target, names, text and suggestions, and counts each code', () => {
    const list = toCheckList(checkedPeer().state);

    expect(list.counts).toEqual({
      unregisteredWord: 1,
      forbiddenWord: 1,
      physicalNameMismatch: 1,
    });
    expect(list.total).toBe(3);
    expect(list).not.toHaveProperty('nextOffset');
    expect(list.checks).toEqual(
      expect.arrayContaining([
        {
          level: 'warning',
          code: 'physicalNameMismatch',
          kind: 'column',
          id: SEED.userId,
          tableId: SEED.users,
          table: 'users',
          name: 'id',
          logicalName: 'Member Number',
          field: 'name',
          text: 'id',
          suggestions: ['MBR_NO'],
        },
        expect.objectContaining({
          level: 'error',
          code: 'forbiddenWord',
          id: SEED.userName,
          logicalName: 'Member Num Name',
          field: 'logicalName',
          text: 'Num',
          suggestions: ['Number'],
        }),
        expect.objectContaining({
          level: 'warning',
          code: 'unregisteredWord',
          text: 'Name',
        }),
      ])
    );
    // A check with nothing to offer carries no suggestions.
    expect(
      list.checks.find(({ code }) => code === 'unregisteredWord')
    ).not.toHaveProperty('suggestions');
  });

  it('keeps one level alone, counting only what it keeps', () => {
    const list = toCheckList(checkedPeer().state, { level: 'error' });

    expect(list.total).toBe(1);
    expect(list.counts).toEqual({ forbiddenWord: 1 });
    expect(list.checks.map(({ code }) => code)).toEqual(['forbiddenWord']);
  });

  it('names a dictionary row by its name, and leaves rows out under a table filter', () => {
    const peer = checkedPeer();
    peer.dispatch([
      dictionaryActions.addDictionaryAction({
        kind: 'word',
        id: 'word_twin',
        values: { name: 'Member', abbreviation: 'MEM' },
      }),
    ]);

    const rows = toCheckList(peer.state).checks.filter(
      ({ kind }) => kind === 'word'
    );
    expect(rows).toEqual([
      expect.objectContaining({
        level: 'error',
        code: 'duplicateName',
        name: 'Member',
        field: 'name',
      }),
      expect.objectContaining({ code: 'duplicateName', id: 'word_twin' }),
    ]);
    expect(rows[0]).not.toHaveProperty('tableId');

    const users = toCheckList(peer.state, { tableNames: ['USERS'] });
    expect(users.checks.every(({ tableId }) => tableId === SEED.users)).toBe(
      true
    );
    expect(users.counts).not.toHaveProperty('duplicateName');
    expect(toCheckList(peer.state, { tableIds: [SEED.orders] }).total).toBe(0);
  });

  it('refuses a table filter naming no live table, through the reader as erd_read does', () => {
    const peer = checkedPeer();

    let refused: unknown;
    try {
      checksReader({ tableNames: ['nowhere'] }).render(peer.state);
    } catch (error) {
      refused = error;
    }

    expect(refused).toBeInstanceOf(ToolError);
    expect(refused).toMatchObject({
      code: ToolErrorCode.notFound,
      tool: CHECKS_TOOL,
    });
    expect((refused as ToolError).message).toContain(
      'nowhere names no live table'
    );
  });

  it('pages by limit and offset, saying where the next page starts', () => {
    const state = checkedPeer().state;

    const first = toCheckList(state, { limit: 2 });
    expect(first.checks).toHaveLength(2);
    expect(first.nextOffset).toBe(2);
    expect(first.note).toContain('checks 1 to 2 of 3');
    expect(first.note).toContain('pass offset 2 with the same filters');
    expect(first.note).toContain('or offset 0 once you have fixed some');

    const last = toCheckList(state, { offset: 2, limit: 2 });
    expect(last.checks).toEqual(toCheckList(state).checks.slice(2));
    expect(last).not.toHaveProperty('nextOffset');
    expect(last).not.toHaveProperty('note');

    expect(toCheckList(state, { offset: 9 }).note).toBe(
      'offset 9 is past the end of the 3 checks the filters keep.'
    );
  });

  it('stops a page where one read is full, whatever the limit', () => {
    const peer = createSeededPeer();
    peers.push(peer);
    for (const [columnId, letter] of [
      [SEED.userId, 'Q'],
      [SEED.userName, 'Z'],
    ]) {
      runTool(peer, 'erd_set_column_logical_name', {
        tableId: SEED.users,
        columnId,
        value: `Member ${letter.repeat(12_000)}`,
      });
    }

    const page = toCheckList(peer.state, { limit: 100 });

    expect(page.total).toBe(2);
    expect(page.checks).toHaveLength(1);
    expect(page.nextOffset).toBe(1);
    expect(JSON.stringify(page).length).toBeLessThanOrEqual(MAX_READ_CHARS);
  });

  it('says nothing is checked while the dictionaries hold no row', () => {
    const peer = createPeerStore({ nickname: 'agent', presence: false });
    peers.push(peer);

    expect(toCheckList(peer.state)).toEqual({
      total: 0,
      counts: {},
      note: 'The dictionaries hold no word, term or domain, so nothing is checked.',
      checks: [],
    });
  });
});
