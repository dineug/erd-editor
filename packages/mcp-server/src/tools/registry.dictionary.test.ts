import {
  bHas,
  ColumnOption,
  dictionaryActions,
  dictionaryActions$,
  type PeerStore,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { runTool } from '@/tools/run';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

const seeded = () => {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
};

function refusal(call: () => unknown): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the call was not refused');
}

const termOf = (peer: PeerStore, id: string) =>
  peer.state.collections.termEntities[id];

const columnOf = (peer: PeerStore, id: string) =>
  peer.state.collections.tableColumnEntities[id];

const tableOf = (peer: PeerStore, id: string) =>
  peer.state.collections.tableEntities[id];

const isDerived = (peer: PeerStore, columnId: string) =>
  bHas(columnOf(peer, columnId).options, ColumnOption.nameDerived);

/** What a batch says, its version stamps aside, which differ between peers. */
const sentOf = (actions: AnyAction[]) =>
  actions.map(({ type, payload }) => ({ type, payload }));

describe('a name a dictionary holds is refused', () => {
  it('refuses an add of a word named as another, trimmed as the editor compares, and sends nothing', () => {
    const peer = seeded();
    const words = [...peer.state.doc.wordIds];

    const refused = refusal(() =>
      runTool(peer, 'erd_add_word', { name: ' Member ', abbreviation: 'M' })
    );

    expect(refused.code).toBe(ToolErrorCode.invalidArgs);
    expect(refused.message).toContain(
      `name "Member" is another word's already`
    );
    expect(peer.state.doc.wordIds).toEqual(words);
  });

  it('refuses renaming a word to another word’s name, and takes its own name back as no change', () => {
    const peer = seeded();

    const refused = refusal(() =>
      runTool(peer, 'erd_update_word', {
        wordId: SEED.memberWord,
        name: 'Number',
      })
    );
    const same = runTool(peer, 'erd_update_word', {
      wordId: SEED.memberWord,
      name: 'Member',
    });

    expect(refused.message).toContain(`name "Number" is another word's`);
    expect(same.batches).toBe(0);
    expect(same.mismatch).toBeUndefined();
  });

  it('refuses an update that names no field, listing the fields it takes', () => {
    const peer = seeded();

    const refused = refusal(() =>
      runTool(peer, 'erd_update_term', { termId: SEED.term })
    );

    expect(refused.message).toBe(
      'pass at least one field to change: name, physicalName, domainId, domainName, description, synonyms'
    );
  });
});

describe('a domain by its name', () => {
  it('links a new term to the domain its name gives, and composes its physical name', () => {
    const peer = seeded();

    const [id] = runTool(peer, 'erd_add_term', {
      name: 'Number',
      domainName: ' Identifier ',
    }).createdIds;

    expect(termOf(peer, id)).toMatchObject({
      name: 'Number',
      physicalName: 'NO',
      domainId: SEED.domain,
    });
  });

  it('links the first of two domains sharing a name in the order the sheet shows, as the domain cell does', () => {
    const peer = seeded();
    peer.dispatch([
      dictionaryActions.addDictionaryAction({
        kind: 'domain',
        id: 'domain_twin',
        values: { name: 'Identifier', dataType: 'BIGINT', order: 'a0' },
      }),
      dictionaryActions.updateDictionaryAction({
        kind: 'domain',
        id: SEED.domain,
        values: { order: 'b0' },
      }),
    ]);

    const [id] = runTool(peer, 'erd_add_term', {
      name: 'Number',
      domainName: 'Identifier',
    }).createdIds;

    expect(termOf(peer, id).domainId).toBe('domain_twin');
  });

  it('refuses a name no domain holds, and a domain given both ways', () => {
    const peer = seeded();

    const unknown = refusal(() =>
      runTool(peer, 'erd_add_term', { name: 'Order', domainName: 'Money' })
    );
    const both = refusal(() =>
      runTool(peer, 'erd_update_term', {
        termId: SEED.term,
        domainId: SEED.domain,
        domainName: 'Identifier',
      })
    );

    expect(unknown.message).toBe(
      'domainName "Money" names no domain of the document'
    );
    expect(both.message).toBe('pass domainId or domainName, not both');
    expect(peer.state.doc.termIds).toEqual([SEED.term]);
  });

  it('clears a term’s domain with an empty name or a null id', () => {
    for (const domain of [{ domainName: '' }, { domainId: null }]) {
      const peer = seeded();

      runTool(peer, 'erd_update_term', { termId: SEED.term, ...domain });

      expect(termOf(peer, SEED.term).domainId).toBe('');
    }
  });

  it('unlinks a column by an empty name, keeping its type, and asks for one of the two', () => {
    const peer = seeded();

    const none = refusal(() =>
      runTool(peer, 'erd_set_column_domain', {
        tableId: SEED.users,
        columnId: SEED.userId,
      })
    );
    runTool(peer, 'erd_set_column_domain', {
      tableId: SEED.users,
      columnId: SEED.userId,
      domainName: '',
    });

    expect(none.message).toBe(
      'pass domainId or domainName; null, or an empty name, unlinks'
    );
    expect(columnOf(peer, SEED.userId)).toMatchObject({
      domainId: '',
      dataType: 'INT',
    });
  });
});

describe('the agent derives a name as the editor does', () => {
  // The editor's logical name cells and Replace All dispatch these generators.
  const editorCell = {
    column: (columnId: string, value: string) =>
      dictionaryActions$.setColumnLogicalNameAction$(
        SEED.users,
        columnId,
        value
      ),
    table: (value: string) =>
      dictionaryActions$.setTableLogicalNameAction$(SEED.users, value),
  };

  it.each([
    // The term of the name gives its physical name and its domain's type.
    ['Member Number', 'MBR_NO', SEED.domain, 'INT'],
    // No term: the words compose it, and the column keeps its type.
    ['Number Member', 'NO_MBR', '', 'VARCHAR(255)'],
  ])(
    'writes %s on a derived column as the editor’s cell does: %s',
    (value, name, domainId, dataType) => {
      const agent = seeded();
      const editor = seeded();

      const run = runTool(agent, 'erd_set_column_logical_name', {
        tableId: SEED.users,
        columnId: SEED.userName,
        value,
      });
      const report = editor.dispatch([editorCell.column(SEED.userName, value)]);

      expect(sentOf(run.actions)).toEqual(sentOf(report.actions));
      for (const peer of [agent, editor]) {
        expect(columnOf(peer, SEED.userName)).toMatchObject({
          logicalName: value,
          name,
          domainId,
          dataType,
        });
        expect(isDerived(peer, SEED.userName)).toBe(true);
      }
    }
  );

  it('derives a table name from the term alone, linking no domain, as the editor’s cell does', () => {
    const agent = seeded();
    const editor = seeded();

    const run = runTool(agent, 'erd_set_table_logical_name', {
      tableId: SEED.users,
      value: 'Member Number',
    });
    const report = editor.dispatch([editorCell.table('Member Number')]);

    expect(sentOf(run.actions)).toEqual(sentOf(report.actions));
    expect(tableOf(agent, SEED.users)).toMatchObject({
      logicalName: 'Member Number',
      name: 'MBR_NO',
      nameDerived: true,
    });
  });

  it('leaves a name written by hand, writing the logical name alone', () => {
    const peer = seeded();

    const run = runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'Member Number',
    });

    expect(run.actions.map(({ type }) => type)).toEqual([
      'column.changeLogicalName',
    ]);
    expect(columnOf(peer, SEED.userId)).toMatchObject({
      logicalName: 'Member Number',
      name: 'id',
    });
  });
});

describe('a rename by hand turns the derived flag off', () => {
  it('turns a derived table name into its own, so a logical name leaves it after', () => {
    const peer = seeded();

    const renamed = runTool(peer, 'erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });
    runTool(peer, 'erd_set_table_logical_name', {
      tableId: SEED.users,
      value: 'Member Number',
    });

    expect(sentOf(renamed.actions)).toEqual([
      {
        type: 'table.changeName',
        payload: { id: SEED.users, value: 'members' },
      },
      {
        type: 'table.changeNameDerived',
        payload: { id: SEED.users, value: false },
      },
    ]);
    expect(renamed.historyEntries).toBe(1);
    expect(tableOf(peer, SEED.users)).toMatchObject({
      name: 'members',
      logicalName: 'Member Number',
      nameDerived: false,
    });
  });

  it('turns a derived column name into its own, so a logical name leaves it after', () => {
    const peer = seeded();

    const renamed = runTool(peer, 'erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'full_name',
    });
    runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'Member Number',
    });

    expect(renamed.actions.map(({ type }) => type)).toEqual([
      'column.changeName',
      'column.changeNameDerived',
    ]);
    expect(renamed.historyEntries).toBe(1);
    expect(isDerived(peer, SEED.userName)).toBe(false);
    expect(columnOf(peer, SEED.userName)).toMatchObject({
      name: 'full_name',
      logicalName: 'Member Number',
      domainId: '',
    });
  });

  it('derives a name again once a rename by hand left it empty', () => {
    const peer = seeded();

    runTool(peer, 'erd_change_table_name', { tableId: SEED.users, value: '' });
    runTool(peer, 'erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: '',
    });
    runTool(peer, 'erd_set_table_logical_name', {
      tableId: SEED.users,
      value: 'Member Number',
    });
    runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'Member Number',
    });

    expect(tableOf(peer, SEED.users)).toMatchObject({
      name: 'MBR_NO',
      nameDerived: true,
    });
    expect(isDerived(peer, SEED.userName)).toBe(true);
    expect(columnOf(peer, SEED.userName)).toMatchObject({
      name: 'MBR_NO',
      domainId: SEED.domain,
    });
  });

  it('sends the rename alone where the name was not derived', () => {
    const peer = seeded();

    const table = runTool(peer, 'erd_change_table_name', {
      tableId: SEED.orders,
      value: 'purchases',
    });
    const column = runTool(peer, 'erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'member_id',
    });

    expect(table.actions.map(({ type }) => type)).toEqual(['table.changeName']);
    expect(column.actions.map(({ type }) => type)).toEqual([
      'column.changeName',
    ]);
  });
});

describe('erd_derive_physical_names derives names again as the editor’s command does', () => {
  /** userName composed from the words, then the word Member abbreviated anew. */
  function afterAbbreviationChange(peer: PeerStore) {
    runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'Number Member',
    });
    runTool(peer, 'erd_update_word', {
      wordId: SEED.memberWord,
      abbreviation: 'MEM',
    });
    return peer;
  }

  it('names a table and its columns again after an abbreviation changed, in one undo', () => {
    const agent = afterAbbreviationChange(seeded());
    const editor = afterAbbreviationChange(seeded());
    expect(columnOf(agent, SEED.userName).name).toBe('NO_MBR');

    const run = runTool(agent, 'erd_derive_physical_names', {
      scope: 'table',
      tableId: SEED.users,
    });
    const report = editor.dispatch([
      dictionaryActions$.rederiveNamesAction$({
        scope: 'table',
        tableId: SEED.users,
      }),
    ]);

    expect(sentOf(run.actions)).toEqual(sentOf(report.actions));
    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(tableOf(agent, SEED.users)).toMatchObject({
      name: 'MEM',
      nameDerived: true,
    });
    expect(columnOf(agent, SEED.userName).name).toBe('NO_MEM');
    // A column with no logical name keeps its name.
    expect(columnOf(agent, SEED.userId).name).toBe('id');

    agent.undo();

    expect(tableOf(agent, SEED.users).name).toBe('users');
    expect(columnOf(agent, SEED.userName).name).toBe('NO_MBR');
  });

  it('puts a name written by hand back under the dictionaries, its flag on', () => {
    const peer = seeded();
    runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'Member Number',
    });
    expect(isDerived(peer, SEED.userId)).toBe(false);

    runTool(peer, 'erd_derive_physical_names', {
      scope: 'column',
      tableId: SEED.users,
      columnId: SEED.userId,
    });

    expect(columnOf(peer, SEED.userId)).toMatchObject({
      name: 'MBR_NO',
      domainId: SEED.domain,
      dataType: 'INT',
    });
    expect(isDerived(peer, SEED.userId)).toBe(true);
  });

  it('keeps a self reference’s numbered name, which its copied logical name would derive again', () => {
    const peer = seeded();
    runTool(peer, 'erd_set_column_logical_name', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'Member Number',
    });
    runTool(peer, 'erd_derive_physical_names', {
      scope: 'column',
      tableId: SEED.users,
      columnId: SEED.userId,
    });
    const [selfKey] = runTool(peer, 'erd_add_relationship', {
      startTableId: SEED.users,
      endTableId: SEED.users,
      relationshipType: 'ZeroN',
    }).createdIds;
    expect(columnOf(peer, selfKey)).toMatchObject({
      name: 'MBR_NO_2',
      logicalName: 'Member Number',
    });

    runTool(peer, 'erd_derive_physical_names', { scope: 'document' });

    expect(columnOf(peer, selfKey).name).toBe('MBR_NO_2');
    expect(isDerived(peer, selfKey)).toBe(false);
    expect(columnOf(peer, SEED.userId).name).toBe('MBR_NO');
  });

  it('covers every table with scope document, leaving a table with no logical name', () => {
    const peer = seeded();

    runTool(peer, 'erd_derive_physical_names', { scope: 'document' });

    expect(tableOf(peer, SEED.users).name).toBe('MBR');
    expect(tableOf(peer, SEED.orders)).toMatchObject({
      name: 'orders',
      nameDerived: false,
    });
  });

  it('refuses a scope without what it names, or with more, and a column without its table', () => {
    const peer = seeded();
    const refusedWith = (args: Record<string, unknown>) =>
      refusal(() => runTool(peer, 'erd_derive_physical_names', args));

    expect(
      refusedWith({ scope: 'column', tableId: SEED.users }).message
    ).toContain('scope column needs tableId and columnId');
    expect(refusedWith({ scope: 'table' }).message).toContain(
      'scope table needs tableId'
    );
    expect(
      refusedWith({
        scope: 'table',
        tableId: SEED.users,
        columnId: SEED.userId,
      }).message
    ).toContain('columnId takes scope column, not table');
    expect(
      refusedWith({ scope: 'document', tableId: SEED.users }).message
    ).toContain('scope document takes no tableId');
    expect(
      refusedWith({ scope: 'document', columnId: SEED.userId }).message
    ).toContain('columnId needs tableId');
    expect(tableOf(peer, SEED.users).name).toBe('users');
  });
});
