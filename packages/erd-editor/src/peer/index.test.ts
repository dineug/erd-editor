// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH, MEMO_MIN_HEIGHT } from '@/constants/layout';
import { Database, Show } from '@/constants/schema';
import { DatabaseVendorList } from '@/constants/sql/database';
import { ChangeActionTypes } from '@/engine/actions';
import { createEngineContext } from '@/engine/context';
import { actions$ as editorActions$ } from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { actions as memoActions } from '@/engine/modules/memo/atom.actions';
import { actions as tableActions } from '@/engine/modules/table/atom.actions';
import { actions$ as tableActions$ } from '@/engine/modules/table/generator.actions';
import {
  createPeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@/engine/peer-store';
import { defaultToWidth } from '@/engine/to-width';
import * as peer from '@/peer';
import { bHas } from '@/utils/bit';
import { createSchemaSQL } from '@/utils/schema-sql';

describe('peer barrel (AC-B2)', () => {
  it('exposes exactly the 43 values the headless peer needs', () => {
    expect(Object.keys(peer).sort()).toEqual(
      [
        'createPeerStore',
        'PeerStoreError',
        'PeerStoreErrorCode',
        'createEngineContext',
        'defaultToWidth',
        'editorActions$',
        'tableActions$',
        'tableColumnActions$',
        'indexActions$',
        'indexColumnActions$',
        'memoActions$',
        'relationshipActions$',
        'settingsActions$',
        'tableActions',
        'tableColumnActions',
        'indexActions',
        'indexColumnActions',
        'memoActions',
        'relationshipActions',
        'settingsActions',
        'ChangeActionTypes',
        'StreamActionTypes',
        'SharedFollowingActionTypes',
        'FocusType',
        'SelectType',
        'ColumnOption',
        'OrderType',
        'RelationshipType',
        'BracketType',
        'CanvasType',
        'ColumnType',
        'Database',
        'Language',
        'NameCase',
        'SaveSettingType',
        'Show',
        'MEMO_MIN_WIDTH',
        'MEMO_MIN_HEIGHT',
        'COLUMN_MIN_WIDTH',
        'createSchemaSQL',
        'DatabaseVendorList',
        'DatabaseVendorToDatabase',
        'bHas',
      ].sort()
    );
    expect(Object.keys(peer)).toHaveLength(43);
  });

  it('re-exports each name from the module that owns it', () => {
    expect(peer.createPeerStore).toBe(createPeerStore);
    expect(peer.PeerStoreError).toBe(PeerStoreError);
    expect(peer.PeerStoreErrorCode).toBe(PeerStoreErrorCode);
    expect(peer.createEngineContext).toBe(createEngineContext);
    expect(peer.defaultToWidth).toBe(defaultToWidth);
    expect(peer.editorActions$).toBe(editorActions$);
    expect(peer.tableActions$).toBe(tableActions$);
    expect(peer.tableActions).toBe(tableActions);
    expect(peer.memoActions).toBe(memoActions);
    expect(peer.ChangeActionTypes).toBe(ChangeActionTypes);
    expect(peer.FocusType).toBe(FocusType);
    expect(peer.Database).toBe(Database);
    expect(peer.Show).toBe(Show);
    expect(peer.MEMO_MIN_HEIGHT).toBe(MEMO_MIN_HEIGHT);
    expect(peer.COLUMN_MIN_WIDTH).toBe(COLUMN_MIN_WIDTH);
    expect(peer.createSchemaSQL).toBe(createSchemaSQL);
    expect(peer.DatabaseVendorList).toBe(DatabaseVendorList);
    expect(peer.bHas).toBe(bHas);
  });

  it('keeps the catalog per module and exports no flat actions map', () => {
    // Spread flat, memo's changeZIndexAction and table's share one key and the
    // later spread wins, so a caller would get the other module's creator. Per
    // module barrels shadow nothing, so the flat map stays out of this entry.
    expect(peer).not.toHaveProperty('actions');
    expect(peer).not.toHaveProperty('actions$');
    expect(peer.memoActions.changeZIndexAction).not.toBe(
      peer.tableActions.changeZIndexAction
    );
    expect(peer).not.toHaveProperty('tableReducers');
    expect(peer).not.toHaveProperty('createRxStore');
  });

  it('builds a working peer store through the barrel', () => {
    const store = peer.createPeerStore({ nickname: 'agent', presence: false });
    store.setInitialValue('');

    const report = store.dispatch([peer.tableActions$.addTableAction$()], {
      label: 'addTable',
    });

    expect(report.createdIds).toHaveLength(1);
    expect(JSON.parse(store.value).doc.tableIds).toEqual(report.createdIds);
    expect(store.undo()).toEqual({
      label: 'addTable',
      entries: 1,
      skipped: [],
    });
    expect(JSON.parse(store.value).doc.tableIds).toEqual([]);

    store.destroy();
  });
});
