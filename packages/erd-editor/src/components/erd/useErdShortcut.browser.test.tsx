// Escape on a real keyboard, heard by a document listener standing in for the
// host page. A trusted press drains microtasks between listeners, so a blur can
// end an edit before the key binding reads it; a synthetic press never does.

import { createRef, FC, ref, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import { useAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import { themeContext } from '@/components/themeContext';
import { RelationshipType } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  editMemoAction,
  editTableAction,
  focusColumnAction,
  focusTableAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { whenDrawn } from '@/konva/batchDraw';
import { forceFocusEvent } from '@/utils/internalEvents';

const MEMO_ID = 'note';

/** The part of ErdEditor that reads the keyboard, around the scene it drives. */
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
      <Erd isDarkMode={false} mouseTracking={false} />
    </div>
  );
};

type Fixture = {
  mounted: Mounted;
  root: HTMLDivElement;
  tableId: string;
  columnId: string;
  /** Whether each Escape the page heard had its default prevented, in order. */
  heard: boolean[];
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** A table with one column, selected and focused, and a memo beside it. */
async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  const mounted = mount(<Editor />, app);
  mounted.container.setAttribute(
    'style',
    'width: 800px; height: 600px; position: relative;'
  );

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  const root = mounted.container.querySelector('.root') as HTMLDivElement;
  // What ErdEditor answers the event with, ctx.focus() on its root.
  const focusRoot = () => root.focus();
  document.body.addEventListener(forceFocusEvent.type, focusRoot);

  const heard: boolean[] = [];
  const listen = (event: KeyboardEvent) => {
    event.key === 'Escape' && heard.push(event.defaultPrevented);
  };
  document.addEventListener('keydown', listen);

  const { store } = app;
  store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  store.dispatchSync(addColumnAction$(tableId));
  const columnId = store.state.collections.tableEntities[tableId].columnIds[0];
  store.dispatchSync(
    addMemoAction({
      id: MEMO_ID,
      ui: { x: 480, y: 80, width: 240, height: 140, zIndex: 3 },
    })
  );

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    document.removeEventListener('keydown', listen);
    document.body.removeEventListener(forceFocusEvent.type, focusRoot);
    mounted.unmount();
    themeProvider.destroy();
  });

  return { mounted, root, tableId, columnId, heard };
}

const editorOf = ({ mounted }: Fixture) => mounted.app.store.state.editor;

const openEditorOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector(
    '.edit-overlay input, .edit-overlay textarea'
  ) as HTMLInputElement | HTMLTextAreaElement | null;

/** Everything the first Escape has to leave the way the edit found it. */
const snapshot = (fixture: Fixture) => {
  const { focusTable, selectedMap } = editorOf(fixture);

  return {
    selectedMap: { ...selectedMap },
    focusTable: focusTable
      ? {
          tableId: focusTable.tableId,
          columnId: focusTable.columnId,
          focusType: focusTable.focusType,
          selectColumnIds: [...focusTable.selectColumnIds],
          edit: focusTable.edit,
        }
      : null,
  };
};

const pressEscape = async () => {
  await userEvent.keyboard('{Escape}');
  await flush();
};

const focusCell =
  (focusType: FocusType) =>
  ({ mounted, tableId, columnId }: Fixture) =>
    mounted.app.store.dispatchSync(
      focusType === FocusType.tableName || focusType === FocusType.tableComment
        ? focusTableAction({ tableId, focusType })
        : focusColumnAction({
            tableId,
            columnId,
            focusType,
            $mod: false,
            shiftKey: false,
          })
    );

const CELLS = [
  ['a table name', FocusType.tableName],
  ['a table comment', FocusType.tableComment],
  ['a column name', FocusType.columnName],
  ['a column data type', FocusType.columnDataType],
  ['a column default', FocusType.columnDefault],
  ['a column comment', FocusType.columnComment],
] as const;

/** Opens the cell editor and waits for it to take the caret. */
async function editCell(fixture: Fixture, focusType: FocusType) {
  focusCell(focusType)(fixture);
  await flush();
  const before = snapshot(fixture);

  fixture.mounted.app.store.dispatchSync(editTableAction());
  await flush();

  const input = openEditorOf(fixture);
  expect(input).toBeInstanceOf(HTMLInputElement);
  expect(document.activeElement).toBe(input);

  return before;
}

async function editMemo(fixture: Fixture) {
  const { store } = fixture.mounted.app;
  store.dispatchSync(
    unselectAllAction(),
    selectAction({ [MEMO_ID]: SelectType.memo })
  );
  await flush();
  const before = snapshot(fixture);

  store.dispatchSync(editMemoAction({ id: MEMO_ID }));
  await flush();

  const textarea = openEditorOf(fixture);
  expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
  expect(document.activeElement).toBe(textarea);

  return before;
}

describe('Escape on a real keyboard - a cell editor', () => {
  it.each(CELLS)(
    'ends %s alone first, prevented, and unselects on the next press',
    async (_name, focusType) => {
      const fixture = await setup();
      const before = await editCell(fixture, focusType);

      await pressEscape();

      expect(snapshot(fixture)).toEqual(before);
      expect(openEditorOf(fixture)).toBeNull();
      expect(document.activeElement).toBe(fixture.root);
      expect(fixture.heard).toEqual([true]);

      await pressEscape();

      expect(editorOf(fixture).selectedMap).toEqual({});
      expect(editorOf(fixture).focusTable).toBeNull();
      expect(fixture.heard).toEqual([true, false]);
    }
  );

  it('keeps the text typed into the cell', async () => {
    const fixture = await setup();
    await editCell(fixture, FocusType.tableName);

    await userEvent.keyboard('accounts');
    await pressEscape();

    const table =
      fixture.mounted.app.store.state.collections.tableEntities[
        fixture.tableId
      ];
    expect(table.name).toBe('accounts');
    expect(editorOf(fixture).focusTable?.edit).toBe(false);
  });
});

describe('Escape on a real keyboard - the memo body editor', () => {
  it('ends the edit alone first, prevented, and unselects on the next press', async () => {
    const fixture = await setup();
    const before = await editMemo(fixture);

    await pressEscape();

    expect(editorOf(fixture).editMemoId).toBeNull();
    expect(snapshot(fixture)).toEqual(before);
    expect(openEditorOf(fixture)).toBeNull();
    expect(document.activeElement).toBe(fixture.root);
    expect(fixture.heard).toEqual([true]);

    await pressEscape();

    expect(editorOf(fixture).selectedMap).toEqual({});
    expect(fixture.heard).toEqual([true, false]);
  });
});

describe('Escape on a real keyboard - a relationship draw', () => {
  it('cancels the draw alone first, prevented, and unselects on the next press', async () => {
    const fixture = await setup();
    const { store } = fixture.mounted.app;
    const before = snapshot(fixture);
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN }),
      drawStartAddRelationshipAction({ tableId: fixture.tableId })
    );
    fixture.root.focus();
    await flush();

    await pressEscape();

    expect(editorOf(fixture).drawRelationship).toBeNull();
    expect(snapshot(fixture)).toEqual(before);
    expect(fixture.heard).toEqual([true]);

    await pressEscape();

    expect(editorOf(fixture).selectedMap).toEqual({});
    expect(fixture.heard).toEqual([true, false]);
  });
});

describe('Escape on a real keyboard - nothing being edited', () => {
  it('unselects at once and leaves the press to the page', async () => {
    const fixture = await setup();
    expect(Object.keys(editorOf(fixture).selectedMap)).toEqual([
      fixture.tableId,
    ]);
    fixture.root.focus();

    await pressEscape();

    expect(editorOf(fixture).selectedMap).toEqual({});
    expect(editorOf(fixture).focusTable).toBeNull();
    expect(fixture.heard).toEqual([false]);
  });
});

describe('Escape an IME composition still owns', () => {
  const COMPOSING = [
    ['isComposing', { isComposing: true }],
    ['keyCode 229', { keyCode: 229 }],
  ] as const;

  const pressComposing = (target: Element, init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };

  it.each(COMPOSING)(
    'leaves the cell editor open and the press unprevented while the IME reports %s',
    async (_label, init) => {
      const fixture = await setup();
      await editCell(fixture, FocusType.columnName);
      const before = snapshot(fixture);

      const event = pressComposing(openEditorOf(fixture)!, init);
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(snapshot(fixture)).toEqual(before);
      expect(openEditorOf(fixture)).toBeInstanceOf(HTMLInputElement);
    }
  );

  it.each(COMPOSING)(
    'leaves the memo editor open and the press unprevented while the IME reports %s',
    async (_label, init) => {
      const fixture = await setup();
      await editMemo(fixture);

      const event = pressComposing(openEditorOf(fixture)!, init);
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(editorOf(fixture).editMemoId).toBe(MEMO_ID);
      expect(editorOf(fixture).selectedMap).toEqual({
        [MEMO_ID]: SelectType.memo,
      });
      expect(openEditorOf(fixture)).toBeInstanceOf(HTMLTextAreaElement);
    }
  );
});
