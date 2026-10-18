import { describe, expect, it } from 'vite-plus/test';

import {
  type ActiveEdit,
  cancelEdit,
  closeEdit,
  commitEdit,
  EDIT_IDLE,
  type EditRequest,
  type EditState,
  inputDraft,
  isReadonly,
  startEdit,
  writableChanges,
} from '@/model/editing';
import { fillTargets, pasteTargets } from '@/model/tsv';
import type { CellStyle, ColumnDef } from '@/model/types';

const NAME: ColumnDef = { id: 'name', label: 'Name' };

const CODE: ColumnDef = { id: 'code', label: 'Code', readonly: true };

const NOTE: ColumnDef = { id: 'note', label: 'Note' };

const request = (overrides: Partial<EditRequest> = {}): EditRequest => ({
  cell: { row: 3, col: 0 },
  column: NAME,
  value: 'before',
  trigger: { kind: 'enter' },
  ...overrides,
});

function editing(overrides: Partial<EditRequest> = {}): ActiveEdit {
  const state = startEdit(EDIT_IDLE, request(overrides));

  if (state.status !== 'editing') throw new Error('the edit did not start');
  return state;
}

describe('isReadonly', () => {
  it('skips a cell whose column is readonly, or whose own style is', () => {
    expect(isReadonly(CODE, undefined)).toBe(true);
    expect(isReadonly(NAME, { readonly: true })).toBe(true);
    expect(isReadonly(CODE, { readonly: false })).toBe(true);
  });

  it('writes to a cell neither marks', () => {
    expect(isReadonly(NAME, undefined)).toBe(false);
    expect(isReadonly(NAME, { background: '#ffffff' })).toBe(false);
    expect(isReadonly({ ...NAME, readonly: false }, { readonly: false })).toBe(
      false
    );
  });
});

describe('startEdit', () => {
  it.each(['doubleClick', 'enter', 'f2'] as const)(
    'keeps the value to edit it on %s',
    kind => {
      expect(startEdit(EDIT_IDLE, request({ trigger: { kind } }))).toEqual({
        status: 'editing',
        cell: { row: 3, col: 0 },
        columnId: 'name',
        mode: 'edit',
        original: 'before',
        initialValue: 'before',
        draft: 'before',
        custom: false,
      });
    }
  );

  it('replaces the value with what was typed, and still measures a change against the value', () => {
    const state = editing({ trigger: { kind: 'type', text: 'x' } });

    expect(state.mode).toBe('replace');
    expect(state.initialValue).toBe('x');
    expect(state.draft).toBe('x');
    expect(state.original).toBe('before');
  });

  it('starts empty for a composition, which fills the draft through input', () => {
    const state = editing({ trigger: { kind: 'type', text: '' } });

    expect(state.mode).toBe('replace');
    expect(state.draft).toBe('');
    expect(inputDraft(state, '한')).toMatchObject({ draft: '한' });
  });

  it('starts nothing on a cell its column makes readonly', () => {
    expect(startEdit(EDIT_IDLE, request({ column: CODE }))).toBe(EDIT_IDLE);
    expect(
      startEdit(
        EDIT_IDLE,
        request({ column: CODE, trigger: { kind: 'type', text: 'x' } })
      )
    ).toBe(EDIT_IDLE);
  });

  it('starts nothing on a cell its own style makes readonly', () => {
    const style: CellStyle = { readonly: true };

    expect(
      startEdit(EDIT_IDLE, request({ style, trigger: { kind: 'doubleClick' } }))
    ).toBe(EDIT_IDLE);
  });

  it('hands the edit to the column’s own editor, with the mode and the value it opens with', () => {
    const kept = editing({ custom: true });
    const typed = editing({
      custom: true,
      trigger: { kind: 'type', text: 'q' },
    });

    expect(kept).toMatchObject({
      custom: true,
      mode: 'edit',
      initialValue: 'before',
    });
    expect(typed).toMatchObject({
      custom: true,
      mode: 'replace',
      initialValue: 'q',
    });
  });

  it('keeps a readonly cell from a column’s own editor too', () => {
    expect(startEdit(EDIT_IDLE, request({ column: CODE, custom: true }))).toBe(
      EDIT_IDLE
    );
  });

  it('copies the cell, so the caller’s object cannot move the edit', () => {
    const cell = { row: 1, col: 0 };
    const state = editing({ cell });

    cell.row = 9;
    expect(state.cell).toEqual({ row: 1, col: 0 });
  });

  it('leaves an open edit as it is when asked again, by another cell or by the same one', () => {
    const open = inputDraft(editing(), 'typed');

    expect(startEdit(open, request({ cell: { row: 8, col: 2 } }))).toBe(open);
    expect(startEdit(open, request({ value: 'from a peer' }))).toBe(open);
  });
});

describe('inputDraft', () => {
  it('writes the editor’s text into the draft and nothing else', () => {
    const state = editing();
    const next = inputDraft(state, 'after');

    expect(next).toEqual({ ...state, draft: 'after' });
    expect(state.draft).toBe('before');
  });

  it('changes nothing while no edit is open', () => {
    expect(inputDraft(EDIT_IDLE, 'stray')).toBe(EDIT_IDLE);
  });
});

describe('commitEdit', () => {
  it('ends the edit with the draft as one change, which names its column', () => {
    expect(commitEdit(inputDraft(editing(), 'after'))).toEqual({
      state: EDIT_IDLE,
      change: { row: 3, col: 0, columnId: 'name', value: 'after' },
    });
  });

  it('ends the edit with no change where the draft is what the cell held', () => {
    expect(commitEdit(editing())).toEqual({ state: EDIT_IDLE, change: null });
    expect(
      commitEdit(editing({ trigger: { kind: 'type', text: 'before' } }))
    ).toEqual({ state: EDIT_IDLE, change: null });
  });

  it('commits a value typed over the cell, though it was never edited further', () => {
    expect(
      commitEdit(editing({ trigger: { kind: 'type', text: 'x' } })).change
    ).toEqual({ row: 3, col: 0, columnId: 'name', value: 'x' });
  });

  it('commits a cleared draft as an empty value', () => {
    expect(commitEdit(inputDraft(editing(), '')).change).toMatchObject({
      value: '',
    });
  });

  it('takes the value a column’s own editor hands back over the draft', () => {
    const state = editing({ custom: true });

    expect(commitEdit(state, 'picked').change).toMatchObject({
      value: 'picked',
    });
    expect(commitEdit(state, 'before').change).toBeNull();
  });

  it('changes nothing once the edit has ended, so a second commit sends nothing', () => {
    const { state } = commitEdit(inputDraft(editing(), 'after'));

    expect(commitEdit(state, 'again')).toEqual({
      state: EDIT_IDLE,
      change: null,
    });
  });
});

describe('cancelEdit', () => {
  it('ends the edit into the idle state, where no commit or input lands', () => {
    const state = cancelEdit();

    expect(state).toBe(EDIT_IDLE);
    expect(commitEdit(state).change).toBeNull();
    expect(inputDraft(state, 'late')).toBe(EDIT_IDLE);
  });
});

describe('closeEdit', () => {
  it('cancels the grid’s own editor on Escape', () => {
    expect(closeEdit(inputDraft(editing(), 'after'), 'escape')).toEqual({
      state: EDIT_IDLE,
      change: null,
      signal: null,
    });
  });

  it('commits the grid’s own editor on a press outside it', () => {
    expect(closeEdit(inputDraft(editing(), 'after'), 'outside')).toEqual({
      state: EDIT_IDLE,
      change: { row: 3, col: 0, columnId: 'name', value: 'after' },
      signal: null,
    });
  });

  it('leaves a column’s own editor open and hands it the reason, on Escape and outside alike', () => {
    const state = editing({ custom: true });

    expect(closeEdit(state, 'escape')).toEqual({
      state,
      change: null,
      signal: 'escape',
    });
    expect(closeEdit(state, 'outside')).toEqual({
      state,
      change: null,
      signal: 'outside',
    });
  });

  it('asks nothing of anyone while no edit is open', () => {
    expect(closeEdit(EDIT_IDLE, 'outside')).toEqual({
      state: EDIT_IDLE,
      change: null,
      signal: null,
    });
  });
});

describe('a host change while a cell is edited', () => {
  it('reaches neither the draft nor the commit', () => {
    let hostValue = 'before';
    let state: EditState = startEdit(EDIT_IDLE, request({ value: hostValue }));
    state = inputDraft(state, 'mine');

    hostValue = 'from a peer';
    state = startEdit(state, request({ value: hostValue }));

    expect(state).toMatchObject({ draft: 'mine', original: 'before' });
    expect(commitEdit(state).change).toMatchObject({ value: 'mine' });
  });

  it('is not undone by a draft left as it was', () => {
    let state: EditState = startEdit(EDIT_IDLE, request({ value: 'before' }));
    state = startEdit(state, request({ value: 'from a peer' }));

    expect(commitEdit(state).change).toBeNull();
  });

  it('keeps the column the edit started in, even where the columns change under it', () => {
    let state: EditState = startEdit(EDIT_IDLE, request({ column: NAME }));
    state = startEdit(state, request({ column: NOTE }));

    expect(commitEdit(inputDraft(state, 'after')).change).toMatchObject({
      col: 0,
      columnId: 'name',
    });
  });
});

describe('writableChanges', () => {
  const columns = [NAME, CODE, NOTE];

  it('names the column of every write', () => {
    expect(
      writableChanges(
        [
          { row: 0, col: 0, value: 'a' },
          { row: 1, col: 2, value: 'b' },
        ],
        { rowCount: 10, columns }
      )
    ).toEqual({
      changes: [
        { row: 0, col: 0, columnId: 'name', value: 'a' },
        { row: 1, col: 2, columnId: 'note', value: 'b' },
      ],
      beyondColumns: false,
    });
  });

  it('skips the cells of a readonly column and the cells their style makes readonly', () => {
    const batch = writableChanges(
      fillTargets([{ startRow: 0, startCol: 0, endRow: 1, endCol: 2 }], ''),
      {
        rowCount: 10,
        columns,
        getCellStyle: (row, col) =>
          row === 1 && col === 2 ? { readonly: true } : undefined,
      }
    );

    expect(
      batch.changes.map(({ row, columnId }) => `${row}:${columnId}`)
    ).toEqual(['0:name', '0:note', '1:name']);
    expect(batch.beyondColumns).toBe(false);
  });

  it('drops the writes past the last column and says so, keeping the rest', () => {
    const batch = writableChanges(
      pasteTargets(
        {
          active: { row: 0, col: 1 },
          ranges: [{ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }],
        },
        [['a', 'b', 'c']]
      ),
      { rowCount: 10, columns: [NAME, NOTE] }
    );

    expect(batch).toEqual({
      changes: [{ row: 0, col: 1, columnId: 'note', value: 'a' }],
      beyondColumns: true,
    });
  });

  it('keeps the rows past the last one, and never asks the style hook about them', () => {
    const asked: number[] = [];
    const batch = writableChanges(
      [
        { row: 1, col: 0, value: 'a' },
        { row: 2, col: 0, value: 'b' },
        { row: 3, col: 0, value: 'c' },
      ],
      {
        rowCount: 2,
        columns,
        getCellStyle: row => {
          asked.push(row);
          return undefined;
        },
      }
    );

    expect(batch.changes.map(change => change.row)).toEqual([1, 2, 3]);
    expect(asked).toEqual([1]);
  });

  it('hands back no change where every write is readonly or past the columns', () => {
    expect(
      writableChanges(
        [
          { row: 0, col: 1, value: 'a' },
          { row: 0, col: 3, value: 'b' },
        ],
        { rowCount: 1, columns }
      )
    ).toEqual({ changes: [], beyondColumns: true });
  });
});
