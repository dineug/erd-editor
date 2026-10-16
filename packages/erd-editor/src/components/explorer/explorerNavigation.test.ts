import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedExplorerDocument } from '@/__test-utils__/explorerSeed';
import type { AppContext } from '@/components/appContext';
import {
  dropRelationshipHighlight,
  isRelationshipHighlighted,
} from '@/components/erd/relationshipHighlight';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';

import { activateNode, targetOf } from './explorerNavigation';
import type { ExplorerNode } from './explorerTree';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
  seedExplorerDocument(app);
  app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
});

afterEach(() => {
  dropRelationshipHighlight(app.store.state.editor.id);
  app.store.destroy();
});

const selected = () => app.store.state.editor.selectedMap;
const table = (tableId: string): ExplorerNode => ({
  kind: 'table',
  tableId,
  name: tableId,
});
const foreignKey: ExplorerNode = {
  kind: 'foreignKey',
  relationshipId: 'rel',
  tableId: 'orders',
  identification: false,
  columns: 'user_id',
  parent: 'users',
  parentColumns: 'id',
};

describe('targetOf', () => {
  it('goes nowhere for a folder, which only folds and unfolds (AC-N4)', () => {
    expect(targetOf({ kind: 'folder', folder: 'tables', count: 1 })).toBeNull();
  });

  it('sends an index and a group member to their table, and a column to its name cell (AC-N2)', () => {
    expect(
      targetOf({
        kind: 'index',
        tableId: 'orders',
        indexId: 'idx',
        name: 'i',
        unique: false,
        columns: '',
      })
    ).toEqual({ kind: 'table', tableId: 'orders' });
    expect(
      targetOf({
        kind: 'groupTable',
        tableGroupId: 'billing',
        tableId: 'orders',
        name: 'orders',
      })
    ).toEqual({ kind: 'table', tableId: 'orders' });
    expect(
      targetOf({
        kind: 'column',
        tableId: 'orders',
        columnId: 'orders.id',
        name: 'id',
        dataType: '',
        primaryKey: true,
        foreignKey: false,
      })
    ).toEqual({
      kind: 'column',
      tableId: 'orders',
      columnId: 'orders.id',
      focusType: FocusType.columnName,
    });
  });
});

describe('activateNode', () => {
  it('selects a table alone and adds no relationship with a draw armed (AC-N1)', () => {
    app.store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );

    activateNode(app.store, table('apple'));

    expect(selected()).toEqual({ apple: SelectType.table });
    expect(app.store.state.doc.relationshipIds).toEqual(['rel']);
  });

  it('takes the ERD tab from another before it jumps', () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );

    activateNode(app.store, table('users'));

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(selected()).toEqual({ users: SelectType.table });
  });

  it('lights a foreign key and selects its child table alone with the key columns (AC-N3)', () => {
    activateNode(app.store, table('users'));

    activateNode(app.store, foreignKey);

    expect(selected()).toEqual({ orders: SelectType.table });
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders.user_id',
      selectColumnIds: ['orders.user_id'],
    });
    expect(isRelationshipHighlighted(app.store.state.editor.id, 'rel')).toBe(
      true
    );
  });

  it.each([
    ['a relationship removed', () => removeRelationshipAction({ id: 'rel' })],
    ['its child table removed', () => removeTableAction({ id: 'orders' })],
  ])(
    'lights nothing once %s, so an undo brings no stale light',
    (_, remove) => {
      app.store.dispatchSync(remove());

      activateNode(app.store, foreignKey);

      expect(isRelationshipHighlighted(app.store.state.editor.id, 'rel')).toBe(
        false
      );
    }
  );

  it('puts the light out on a jump to any other row (AC-N12)', () => {
    activateNode(app.store, foreignKey);

    activateNode(app.store, { kind: 'memo', memoId: 'note', text: '' });

    expect(isRelationshipHighlighted(app.store.state.editor.id, 'rel')).toBe(
      false
    );
    expect(selected()).toEqual({ note: SelectType.memo });
  });

  it('selects a group alone (AC-N4)', () => {
    activateNode(app.store, {
      kind: 'tableGroup',
      tableGroupId: 'billing',
      name: 'Billing',
      color: '',
    });

    expect(selected()).toMatchObject({ billing: SelectType.tableGroup });
  });

  it('closes Table Properties before it jumps (N-c)', () => {
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );

    activateNode(app.store, table('orders'));

    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(false);
    expect(selected()).toEqual({ orders: SelectType.table });
  });

  it('does nothing for a folder', () => {
    activateNode(app.store, { kind: 'folder', folder: 'memos', count: 1 });

    expect(selected()).toEqual({});
  });
});
