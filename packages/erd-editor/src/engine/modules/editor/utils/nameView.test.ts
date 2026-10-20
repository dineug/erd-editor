import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnType,
  LockSettingType,
  NameViewMode,
  Show,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import {
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { createEditor, FocusType } from '@/engine/modules/editor/state';
import {
  ColumnTypeShown,
  drawsDomainInTypeCell,
  drawsNameForLogicalName,
  getColumnFocusTypes,
  getTableFocusTypes,
  isBothNameView,
  isDomainInTypeCell,
  isLogicalNameView,
  keepFocusShown,
  nameLabelText,
  toNameLabel,
  toNameViewFocusType,
  toShownFocusType,
} from '@/engine/modules/editor/utils/nameView';
import {
  changeLockSettingsAction,
  changeNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';

type Mode = (typeof NameViewMode)[keyof typeof NameViewMode];

const ORDER = [
  ColumnType.columnLogicalName,
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnDomain,
  ColumnType.columnComment,
];

const settingsOf = (nameViewMode: Mode, show = 0) => ({
  nameViewMode,
  show,
  columnOrder: ORDER,
});

function createState(): RootState {
  return { ...schemaV3Parser({}), editor: createEditor(), lww: {} };
}

function createTestStore(): Store {
  const store = createStore(
    createEngineContext({ toWidth: text => text.length * 10 }),
    false
  );
  store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: 'c1', tableId: 't1' })
  );
  return store;
}

/** A reader's own switch, which shows on its store alone. */
const switchTo = (store: Store, value: Mode) =>
  store.dispatchSync(
    changeNameViewModeAction({
      value,
      shared: false,
      editorId: store.state.editor.id,
    })
  );

describe('the name view a document draws', () => {
  it('tells the three views apart', () => {
    expect(isLogicalNameView(settingsOf(NameViewMode.logical))).toBe(true);
    expect(isLogicalNameView(settingsOf(NameViewMode.both))).toBe(false);
    expect(isBothNameView(settingsOf(NameViewMode.both))).toBe(true);
    expect(isBothNameView(settingsOf(NameViewMode.physical))).toBe(false);
  });

  it('draws the name in a blank logical name cell of the logical view alone', () => {
    const logical = settingsOf(NameViewMode.logical);

    expect(drawsNameForLogicalName(logical, { logicalName: '' })).toBe(true);
    expect(drawsNameForLogicalName(logical, { logicalName: '  ' })).toBe(true);
    expect(drawsNameForLogicalName(logical, { logicalName: 'Member' })).toBe(
      false
    );
    expect(
      drawsNameForLogicalName(settingsOf(NameViewMode.both), {
        logicalName: '',
      })
    ).toBe(false);
  });

  it('stands the type cell for the domain in the logical view while the domain has no cell', () => {
    expect(isDomainInTypeCell(settingsOf(NameViewMode.logical))).toBe(true);
    expect(
      isDomainInTypeCell(settingsOf(NameViewMode.logical, Show.columnDomain))
    ).toBe(false);
    expect(isDomainInTypeCell(settingsOf(NameViewMode.both))).toBe(false);
    expect(isDomainInTypeCell(settingsOf(NameViewMode.physical))).toBe(false);
  });

  it('draws the domain in the type cell only for a listed domain with a name', () => {
    const state = createState();
    state.settings.nameViewMode = NameViewMode.logical;
    state.collections.domainEntities.d1 = {
      id: 'd1',
      name: 'Amount',
      category: '',
      dataType: 'NUMERIC',
      description: '',
    };
    state.collections.domainEntities.d2 = {
      id: 'd2',
      name: '',
      category: '',
      dataType: 'INT',
      description: '',
    };
    state.doc.domainIds = ['d1', 'd2'];

    expect(drawsDomainInTypeCell(state, { domainId: 'd1' })).toBe(true);
    expect(drawsDomainInTypeCell(state, { domainId: 'd2' })).toBe(false);
    expect(drawsDomainInTypeCell(state, { domainId: 'gone' })).toBe(false);
    expect(drawsDomainInTypeCell(state, { domainId: '' })).toBe(false);

    state.settings.nameViewMode = NameViewMode.physical;
    expect(drawsDomainInTypeCell(state, { domainId: 'd1' })).toBe(false);
  });
});

describe('the names a label shows', () => {
  const named = { name: 'member', logicalName: 'Member' };
  const blank = { name: 'member', logicalName: '  ' };
  const nameless = { name: ' ', logicalName: '' };

  it('shows the name alone in the physical view', () => {
    const physical = settingsOf(NameViewMode.physical);

    expect(toNameLabel(physical, named)).toEqual({
      text: 'member',
      after: '',
      standIn: false,
    });
    expect(toNameLabel(physical, nameless)).toEqual({
      text: ' ',
      after: '',
      standIn: false,
    });
  });

  it('shows the logical name in the logical view, the name standing in while it is blank', () => {
    const logical = settingsOf(NameViewMode.logical);

    expect(toNameLabel(logical, named)).toEqual({
      text: 'Member',
      after: '',
      standIn: false,
    });
    expect(toNameLabel(logical, blank)).toEqual({
      text: 'member',
      after: '',
      standIn: true,
    });
    expect(toNameLabel(logical, nameless)).toEqual({
      text: ' ',
      after: '',
      standIn: false,
    });
  });

  it('shows the logical name with the name after it in the view of both, while each is filled', () => {
    const both = settingsOf(NameViewMode.both);

    expect(toNameLabel(both, named)).toEqual({
      text: 'Member',
      after: 'member',
      standIn: false,
    });
    expect(toNameLabel(both, blank)).toEqual({
      text: 'member',
      after: '',
      standIn: false,
    });
    expect(toNameLabel(both, { name: '', logicalName: 'Member' })).toEqual({
      text: 'Member',
      after: '',
      standIn: false,
    });
  });

  it('writes the name after the logical name in brackets as one text', () => {
    expect(
      nameLabelText(toNameLabel(settingsOf(NameViewMode.both), named))
    ).toBe('Member (member)');
    expect(
      nameLabelText(toNameLabel(settingsOf(NameViewMode.logical), named))
    ).toBe('Member');
  });
});

describe('the cells a header and a row lay out', () => {
  it('puts the logical name in the place of the name or before it, the comment last', () => {
    expect(getTableFocusTypes(settingsOf(NameViewMode.physical))).toEqual([
      FocusType.tableName,
    ]);
    expect(
      getTableFocusTypes(settingsOf(NameViewMode.logical, Show.tableComment))
    ).toEqual([FocusType.tableLogicalName, FocusType.tableComment]);
    expect(
      getTableFocusTypes(settingsOf(NameViewMode.both, Show.tableComment))
    ).toEqual([
      FocusType.tableLogicalName,
      FocusType.tableName,
      FocusType.tableComment,
    ]);
  });

  it('shows the logical name cell in the view of both alone and the domain by its bit', () => {
    const show = Show.columnDataType;

    expect(ColumnTypeShown[ColumnType.columnName](settingsOf('logical'))).toBe(
      true
    );
    expect(
      getColumnFocusTypes(settingsOf(NameViewMode.physical, show))
    ).toEqual([FocusType.columnName, FocusType.columnDataType]);
    expect(getColumnFocusTypes(settingsOf(NameViewMode.both, show))).toEqual([
      FocusType.columnLogicalName,
      FocusType.columnName,
      FocusType.columnDataType,
    ]);
    expect(
      getColumnFocusTypes(
        settingsOf(NameViewMode.physical, show | Show.columnDomain)
      )
    ).toEqual([
      FocusType.columnName,
      FocusType.columnDataType,
      FocusType.columnDomain,
    ]);
  });

  it('edits the logical name and the domain in the name and type cells of the logical view', () => {
    expect(
      getColumnFocusTypes(settingsOf(NameViewMode.logical, Show.columnDataType))
    ).toEqual([FocusType.columnLogicalName, FocusType.columnDomain]);
    expect(
      getColumnFocusTypes(
        settingsOf(
          NameViewMode.logical,
          Show.columnDataType | Show.columnDomain
        )
      )
    ).toEqual([
      FocusType.columnLogicalName,
      FocusType.columnDataType,
      FocusType.columnDomain,
    ]);
  });

  it('lays out no cell for a column type this release does not know', () => {
    expect(
      getColumnFocusTypes({
        ...settingsOf(NameViewMode.both),
        columnOrder: [9999],
      })
    ).toEqual([]);
  });

  it('maps a physical cell onto the name view and leaves the rest', () => {
    const logical = settingsOf(NameViewMode.logical);

    expect(toNameViewFocusType(logical, FocusType.tableName)).toBe(
      FocusType.tableLogicalName
    );
    expect(toNameViewFocusType(logical, FocusType.columnName)).toBe(
      FocusType.columnLogicalName
    );
    expect(toNameViewFocusType(logical, FocusType.columnDataType)).toBe(
      FocusType.columnDomain
    );
    expect(toNameViewFocusType(logical, FocusType.columnComment)).toBe(
      FocusType.columnComment
    );
    expect(
      toNameViewFocusType(settingsOf(NameViewMode.both), FocusType.tableName)
    ).toBe(FocusType.tableName);
  });
});

describe('the cell a focus is shown on', () => {
  it('is its own cell while the view lays it out', () => {
    const settings = settingsOf(NameViewMode.both, Show.columnDataType);
    const types = getColumnFocusTypes(settings);

    expect(toShownFocusType(settings, types, FocusType.columnName)).toBe(
      FocusType.columnName
    );
    expect(toShownFocusType(settings, types, FocusType.columnLogicalName)).toBe(
      FocusType.columnLogicalName
    );
  });

  it('is the cell the name view draws in its place, either way', () => {
    const logical = settingsOf(NameViewMode.logical, Show.columnDataType);
    const physical = settingsOf(NameViewMode.physical, Show.columnDataType);
    const header = (settings: ReturnType<typeof settingsOf>) =>
      getTableFocusTypes(settings);

    expect(
      toShownFocusType(logical, header(logical), FocusType.tableName)
    ).toBe(FocusType.tableLogicalName);
    expect(
      toShownFocusType(physical, header(physical), FocusType.tableLogicalName)
    ).toBe(FocusType.tableName);
    expect(
      toShownFocusType(
        logical,
        getColumnFocusTypes(logical),
        FocusType.columnDataType
      )
    ).toBe(FocusType.columnDomain);
    expect(
      toShownFocusType(
        physical,
        getColumnFocusTypes(physical),
        FocusType.columnDomain
      )
    ).toBe(FocusType.columnDataType);
  });

  it('is none for a cell neither it nor its place lays out', () => {
    const settings = settingsOf(NameViewMode.physical, Show.columnDomain);
    const types = getColumnFocusTypes(settings);

    // The type cell is hidden, and the domain's own cell shows no type.
    expect(toShownFocusType(settings, types, FocusType.columnDataType)).toBe(
      null
    );
    expect(toShownFocusType(settings, types, FocusType.columnComment)).toBe(
      null
    );
  });
});

describe('the focus a name view switch moves', () => {
  it('goes onto the cell that now draws what it stood on, closing its editor', () => {
    const store = createTestStore();
    store.dispatchSync(focusTableAction({ tableId: 't1' }));
    store.state.editor.focusTable!.edit = true;

    switchTo(store, NameViewMode.logical);
    expect(store.state.editor.focusTable).toMatchObject({
      focusType: FocusType.tableLogicalName,
      edit: false,
    });

    switchTo(store, NameViewMode.physical);
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
    store.destroy();
  });

  it('stays, editor and all, on a cell the new view lays out too', () => {
    const store = createTestStore();
    switchTo(store, NameViewMode.logical);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnLogicalName,
        $mod: false,
        shiftKey: false,
      })
    );
    store.state.editor.focusTable!.edit = true;

    switchTo(store, NameViewMode.both);
    expect(store.state.editor.focusTable).toMatchObject({
      focusType: FocusType.columnLogicalName,
      edit: true,
    });

    switchTo(store, NameViewMode.physical);
    expect(store.state.editor.focusTable).toMatchObject({
      columnId: 'c1',
      focusType: FocusType.columnName,
      edit: false,
    });
    store.destroy();
  });

  it('moves a shared switch and an unlock that carries a view the same way', () => {
    const store = createTestStore();
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(
      changeNameViewModeAction({
        value: NameViewMode.logical,
        shared: true,
        editorId: 'another',
      })
    );
    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableLogicalName
    );

    store.dispatchSync(
      changeLockSettingsAction({
        lockSettingType: LockSettingType.unlockNameViewMode,
        value: false,
        values: { nameViewMode: NameViewMode.physical },
      })
    );
    expect(store.state.settings.nameViewMode).toBe(NameViewMode.physical);
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
    store.destroy();
  });

  it('leaves a store with no focus, or one on a cell hidden either way, as it was', () => {
    const state = createState();
    keepFocusShown(state);
    expect(state.editor.focusTable).toBeNull();

    state.settings.show = 0;
    state.editor.focusTable = {
      tableId: 't1',
      columnId: null,
      focusType: FocusType.tableComment,
      selectColumnIds: [],
      prevSelectColumnId: null,
      edit: true,
    };
    keepFocusShown(state);
    expect(state.editor.focusTable).toMatchObject({
      focusType: FocusType.tableComment,
      edit: true,
    });
  });

  it('reads a domain row the store lists, whatever the view', () => {
    const store = createTestStore();
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Amount', dataType: 'INT' },
      })
    );

    expect(drawsDomainInTypeCell(store.state, { domainId: 'd1' })).toBe(false);
    switchTo(store, NameViewMode.logical);
    expect(drawsDomainInTypeCell(store.state, { domainId: 'd1' })).toBe(true);
    store.destroy();
  });
});
