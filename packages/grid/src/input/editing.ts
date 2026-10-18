import { nextTick, observable } from '@dineug/r-html';

import { cellArea, cellRect, regionOf } from '@/input/pointer';
import {
  type ActiveEdit,
  cancelEdit,
  type CellChange,
  type CellSource,
  closeEdit,
  type CloseReason,
  commitEdit,
  type CommitOutcome,
  EDIT_IDLE,
  type EditMode,
  type EditState,
  type EditTrigger,
  inputDraft,
  startEdit,
  writableChanges,
} from '@/model/editing';
import type { KeyAction } from '@/model/keys';
import {
  rangesInGrid,
  selectionEquals,
  type SelectModifiers,
} from '@/model/selection';
import { normalizeCellText } from '@/model/text';
import {
  areaCellCount,
  CELL_LIMIT,
  cellCount,
  copyableRanges,
  copyRows,
  fillTargets,
  parse,
  pasteCellCount,
  pasteTargets,
  serialize,
} from '@/model/tsv';
import type {
  CellRef,
  CellStyle,
  ColumnDef,
  GridSelection,
} from '@/model/types';
import type { SceneRect } from '@/scene/layout';
import type { SceneData, SceneState } from '@/scene/state';

/**
 * What a column's own editor is handed as an edit opens on one of its cells.
 * The host renders into the container placed over the cell and answers with
 * commit or cancel; the grid only tells it, through onClose, why to close.
 */
export interface EditorContext {
  /** The editor slot, a sibling of the scroller placed over the cell. */
  container: HTMLElement;
  /** The cell's rectangle, in the grid container's coordinates. */
  rect: DOMRect;
  mode: EditMode;
  /** The text typed when typing opened the editor, or else the cell's value. */
  initialValue: string;
  commit(value: string): void;
  cancel(): void;
  /** Escape asks for a cancel and a press outside for a commit; the edit waits for the answer. */
  onClose(listener: (reason: CloseReason) => void): void;
}

/** One column the host defines; editor, when given, opens in place of the grid's own. */
export interface GridColumn extends ColumnDef {
  editor?: (ctx: EditorContext) => void;
}

/** The one change request the grid makes: every cell an edit, a paste or a clear writes. */
export interface CommitEvent {
  changes: CellChange[];
  source: 'edit' | 'paste' | 'clear';
}

/**
 * A request the grid turned down: a copy over ranges that share no rows or
 * columns, a paste past the last column, or a copy, paste or clear of more
 * cells than the grid handles at once, a million, which it does not start.
 */
export interface RejectEvent {
  reason: 'multi-range-copy' | 'paste-beyond-columns' | 'too-many-cells';
}

/** How far a box sits inside a rectangle on each side, or how much of it a clip hides. */
export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where an editor sits over its cell at the scroll offsets now. A cell the
 * view cuts keeps its box, which the clip trims to the region; a cell out of
 * view is not shown and its box is held inside the cell area.
 */
export interface EditorPlacement {
  box: SceneRect;
  clip: Insets | null;
  shown: boolean;
}

export const NO_INSETS: Readonly<Insets> = Object.freeze({
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
});

/** A text that would split the cell into two rows, which typing never opens an edit with. */
const LINE_BREAK = /[\r\n]/;

/** The line breaks at the end of a pasted text, which a paste onto the cells drops too. */
const TRAILING_BREAKS = /[\r\n]+$/;

/** What the cell draws as a space and the one-line editor never holds: a tab, a line feed, a form feed, a carriage return. */
const CELL_BREAK = /[\t\n\f\r]/;

/** An undo or a redo in the textarea's own history. */
const HISTORY = /^history/;

/** The input types that would split the editor's line, which the grid prevents whatever key or menu asks for them. */
const LINE_INPUTS = new Set(['insertLineBreak', 'insertParagraph']);

/** A shadow root, told by its node type and its host, since another realm's has another class. */
const isShadowRoot = (node: Node): node is ShadowRoot =>
  node.nodeType === 11 && Boolean((node as ShadowRoot).host);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A rectangle moved and cut to lie inside an area, its size kept where it fits. */
export function holdInside(rect: SceneRect, area: SceneRect): SceneRect {
  const width = Math.max(0, Math.min(rect.width, area.width));
  const height = Math.max(0, Math.min(rect.height, area.height));

  return {
    x: clamp(rect.x, area.x, area.x + area.width - width),
    y: clamp(rect.y, area.y, area.y + area.height - height),
    width,
    height,
  };
}

/**
 * Where an editor sits over a cell, the insets taken off its rectangle. A
 * focused element held inside the cell area never asks a scroll container
 * to scroll to its caret, so one whose cell left the view moves in there.
 */
export function placeEditor(
  state: Readonly<SceneData>,
  cell: CellRef,
  insets: Readonly<Insets> = NO_INSETS
): EditorPlacement {
  const rect = cellRect(state, cell);
  const box = {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0, rect.width - insets.left - insets.right),
    height: Math.max(0, rect.height - insets.top - insets.bottom),
  };
  const region = regionOf(state, cell.col);
  const left = Math.max(box.x, region.x);
  const top = Math.max(box.y, region.y);
  const right = Math.min(box.x + box.width, region.x + region.width);
  const bottom = Math.min(box.y + box.height, region.y + region.height);
  const exists =
    cell.row >= 0 &&
    cell.row < state.rowCount &&
    cell.col >= 0 &&
    cell.col < state.columns.length;

  if (!exists || right <= left || bottom <= top) {
    return { box: holdInside(box, cellArea(state)), clip: null, shown: false };
  }

  const clip = {
    left: left - box.x,
    top: top - box.y,
    right: box.x + box.width - right,
    bottom: box.y + box.height - bottom,
  };
  const whole =
    clip.left === 0 && clip.top === 0 && clip.right === 0 && clip.bottom === 0;

  return { box, clip: whole ? null : clip, shown: true };
}

/** The open editor as the template places it: its cell, whose editor it is, and the cell's style when it opened. */
export interface OpenEditor {
  cell: CellRef;
  custom: boolean;
  style: CellStyle | undefined;
}

/** What the editing input reads from the grid and asks of it. */
export interface EditingHost {
  readonly scene: SceneState;
  /** The focus textarea, which becomes the grid's own editor. */
  readonly textarea: HTMLTextAreaElement;
  /** The custom editors' container, a sibling of the scroller. */
  readonly slot: HTMLElement;
  /** The host's columns, whose editors the scene's copy does not type. */
  columns(): readonly GridColumn[];
  selection(): GridSelection;
  /** Whether a press lands on a scrollbar, which scrolls the cell under an open editor and keeps the edit. */
  onScrollbar(event: PointerEvent): boolean;
  /** Moves the selection as Enter or Tab does, once an edit they commit has ended. */
  move(key: 'Enter' | 'Tab', mods: SelectModifiers): void;
  /** Takes a new selection the editing input made, which reaches the scene and the host once. */
  select(selection: GridSelection): void;
  /** Scrolls the least distance that shows a cell whole, as a keyboard move does. */
  reveal(cell: CellRef): void;
  commit(event: CommitEvent): void;
  reject(event: RejectEvent): void;
}

/** The handlers the grid binds on its focus textarea and its editor slot. */
export interface EditingInput {
  /** The open editor, null while none is, behind the proxy the template reads. */
  readonly view: Readonly<{ open: OpenEditor | null }>;
  /** Whether an edit is open, which keyAction reads the keys under. */
  editing(): boolean;
  /** Whether a column's own editor is open with the focus in the slot, where a press on the grid leaves it. */
  holdsFocus(): boolean;
  /** A key keyAction answered with an edit, a clear, a commit or a cancel, which the caller prevented. */
  act(action: KeyAction, key: string): void;
  /** Opens an edit on the cell a double click landed on. */
  doubleClick(cell: CellRef): void;
  /** An input about to land in the textarea: a line break prevented, and an undo or a redo kept inside the open edit. */
  beforeinput(event: InputEvent): void;
  input(event: Event): void;
  compositionstart(): void;
  compositionend(): void;
  copy(event: ClipboardEvent): void;
  paste(event: ClipboardEvent): void;
  blur(): void;
  /** A key inside a column's own editor: Escape asks it to close, unless the editor took it. */
  slotKeydown(event: KeyboardEvent): void;
  /** A blur inside the slot, taken in the capture phase before the editor's own listener. */
  slotBlur(event: FocusEvent): void;
  /** Drops the open edit and the press listener, as an unmount does. */
  dispose(): void;
}

/**
 * The grid's editing input: the focus textarea becomes the editor over the
 * cell, so a composition begun on the cell carries on in it, and a column's
 * own editor opens in the slot. An edit, a paste or a clear is one commit.
 */
export function createEditingInput(host: EditingHost): EditingInput {
  const { scene } = host;
  const view = observable<{ open: OpenEditor | null }>(
    { open: null },
    { shallow: true }
  );
  let edit: EditState = EDIT_IDLE;
  let composing = false;
  /** The cell a composition began on whose column has its own editor, which opens there with the composed text once it ends. */
  let deferred: CellRef | null = null;
  let listeners: Array<(reason: CloseReason) => void> = [];
  /** Counts the edits that ended, so a custom editor's context answers for its own edit alone. */
  let generation = 0;
  /** The value the open editor held before its first input of its own, which an undo in the textarea stops at. */
  let undoFloor = '';
  /** The undos taken inside the open edit, which are all a redo may take back. */
  let redos = 0;
  /** The roots a press passes through on its way to the grid, each with the capture listener it holds while an edit is open. */
  const pressRoots: Array<{ root: Node; listener: (event: Event) => void }> =
    [];
  /** The blur the slot is dispatching, kept to read where the focus is going while it lasts. */
  let slotBlur: FocusEvent | null = null;

  /** Empties the textarea, which an IME composition keeps until it ends, when compositionend empties it. */
  const clearText = () => {
    const { textarea } = host;
    if (!composing && textarea.value !== '') textarea.value = '';
  };

  const source = (): CellSource => ({
    rowCount: scene.state.rowCount,
    columns: host.columns(),
    getCellStyle: scene.state.getCellStyle,
  });

  /** Whether an edit is open in the grid's own editor, the focus textarea. */
  const ownEditorOpen = () => edit.status === 'editing' && !edit.custom;

  /** Whether an edit is open in a column's own editor, in the slot. */
  const customEditorOpen = () => edit.status === 'editing' && edit.custom;

  /** The draft of the grid's own editor, which only the textarea's input writes during an edit. */
  const syncDraft = () => {
    if (ownEditorOpen()) edit = inputDraft(edit, host.textarea.value);
  };

  /** Whether the focus lies in the slot, read in the root the grid is mounted in. */
  const focusInSlot = () => {
    const root = host.textarea.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;

    return Boolean(active && host.slot.contains(active));
  };

  /**
   * Puts the focus back in the textarea where a closing editor held it or let
   * it drop. A blur reads the body as the active element while the focus is
   * still on its way to its related target, which keeps it.
   */
  const reclaimFocus = () => {
    const { textarea } = host;
    const { activeElement, body } = textarea.ownerDocument;
    const leaving =
      slotBlur !== null &&
      slotBlur.eventPhase !== Event.NONE &&
      slotBlur.relatedTarget !== null;

    if (
      focusInSlot() ||
      (!leaving && (!activeElement || activeElement === body))
    ) {
      textarea.focus({ preventScroll: true });
    }
  };

  /** Drops the open edit and the press listeners, so its context and its pending callbacks answer for nothing. */
  const dropEdit = () => {
    edit = EDIT_IDLE;
    generation++;
    listeners = [];
    unwatchPresses();
  };

  const finish = ({ change }: CommitOutcome) => {
    const custom = customEditorOpen();

    dropEdit();
    view.open = null;
    clearText();
    if (custom) reclaimFocus();
    if (change) host.commit({ changes: [change], source: 'edit' });
  };

  /**
   * Escape or a press outside. The grid's own editor cancels or commits; a
   * column's own editor is handed the reason and stays open until its host
   * answers through the context.
   */
  const close = (reason: CloseReason) => {
    if (edit.status !== 'editing') return;

    syncDraft();
    const outcome = closeEdit(edit, reason);
    if (!outcome.signal) {
      finish(outcome);
      return;
    }

    for (const listener of listeners.slice()) listener(outcome.signal);
  };

  /** A press anywhere while an edit is open: one outside the editor and off the scrollbars closes it. */
  const onPress = (event: PointerEvent) => {
    if (edit.status !== 'editing') return;

    const editor = edit.custom ? host.slot : host.textarea;
    if (event.composedPath().includes(editor) || host.onScrollbar(event)) {
      return;
    }

    close('outside');
  };

  /**
   * Listens for every press while an edit is open, first, before the press
   * selects: on the textarea's own root, which sees the whole path, and on
   * each root around it, which reads a press past the host it holds.
   */
  function watchPresses() {
    if (pressRoots.length > 0) return;

    let root: Node = host.textarea.getRootNode();
    let inner: Element | null = null;

    for (;;) {
      const within = inner;
      // A listener outside a closed shadow root sees none of its nodes on
      // the path, so it reads only whether the press reached the host.
      const listener = (event: Event) => {
        if (!within) onPress(event as PointerEvent);
        else if (!event.composedPath().includes(within)) close('outside');
      };
      root.addEventListener('pointerdown', listener, true);
      pressRoots.push({ root, listener });

      if (!isShadowRoot(root)) break;
      inner = root.host;
      root = inner.getRootNode();
    }
  }

  /** Removes every listener watchPresses added, once the edit has ended. */
  function unwatchPresses() {
    for (const { root, listener } of pressRoots.splice(0)) {
      root.removeEventListener('pointerdown', listener, true);
    }
  }

  const openOwn = (
    state: ActiveEdit,
    style: CellStyle | undefined,
    trigger: EditTrigger
  ) => {
    const { textarea } = host;
    view.open = { cell: state.cell, custom: false, style };
    // Typing has already put its text in the textarea, or a composition is
    // filling it, and writing the value now would end the composition.
    if (trigger.kind === 'type') return;

    textarea.focus({ preventScroll: true });
    textarea.value = state.initialValue;
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
    // Chrome scrolls no caret a script placed into view, so once the template
    // has laid the editor out over its cell, its text scrolls to the end.
    const own = generation;
    nextTick(() => {
      if (own === generation) textarea.scrollLeft = textarea.scrollWidth;
    });
  };

  const openCustom = (state: ActiveEdit, editor: GridColumn['editor']) => {
    const own = generation;
    const live = () => own === generation;
    const rect = cellRect(scene.state, state.cell);

    view.open = { cell: state.cell, custom: true, style: undefined };
    clearText();
    editor?.({
      container: host.slot,
      rect: new DOMRect(rect.x, rect.y, rect.width, rect.height),
      mode: state.mode,
      initialValue: state.initialValue,
      commit: value => {
        if (live()) finish(commitEdit(edit, value));
      },
      cancel: () => {
        if (live()) finish({ state: cancelEdit(), change: null });
      },
      onClose: listener => {
        if (live()) listeners.push(listener);
      },
    });
  };

  /** Opens an edit on a cell, in the column's own editor where it has one; answers whether one opened. */
  const open = (cell: CellRef, trigger: EditTrigger): boolean => {
    const { rowCount, getCell, getCellStyle } = scene.state;
    const column = host.columns()[cell.col];
    if (edit.status === 'editing' || !column) return false;
    if (cell.row < 0 || cell.row >= rowCount) return false;

    const style = getCellStyle?.(cell.row, cell.col);
    const custom = typeof column.editor === 'function';
    const value = getCell(cell.row, cell.col);
    // The grid's own editor holds one line, so it opens on the text the cell
    // draws and measures its draft against that: one left as it opened commits
    // nothing, whatever tab or line break the value holds.
    const next = startEdit(edit, {
      cell,
      column,
      value: custom ? value : normalizeCellText(value),
      style,
      custom,
      trigger,
    });
    if (next.status !== 'editing') return false;

    edit = next;
    // Typing opens the edit with the keys it was opened by already in the
    // undo history, and every other trigger writes the value as a script.
    undoFloor = trigger.kind === 'type' ? '' : next.initialValue;
    redos = 0;
    watchPresses();
    // An edit opens on a cell the user can see whole, wherever a scroll left
    // it; one that leaves the view once open stays open and hidden.
    host.reveal(cell);
    if (custom) {
      openCustom(next, column.editor);
    } else {
      openOwn(next, style, trigger);
    }
    return true;
  };

  /** Whether typing or a composition may open an edit with a text: it holds something, all on one line. */
  const isTypedLine = (text: string) => text !== '' && !LINE_BREAK.test(text);

  /** A text as the grid's own editor holds it: the breaks at its end dropped and each other tab or line break a space. */
  const oneLine = (text: string) =>
    normalizeCellText(text.replace(TRAILING_BREAKS, ''));

  /** Puts a line in place of the editor's selection, through the command that keeps the textarea's undo. */
  const insertLine = (line: string) => {
    const { textarea } = host;
    if (!textarea.ownerDocument.execCommand('insertText', false, line)) {
      const { selectionStart, selectionEnd } = textarea;
      textarea.setRangeText(line, selectionStart, selectionEnd, 'end');
    }
  };

  /**
   * A paste into the grid's own editor, which keeps its one line: a text with
   * a tab or line break goes in with the breaks at its end dropped and each
   * other one a space.
   */
  const pasteLine = (event: ClipboardEvent, text: string) => {
    const line = oneLine(text);
    if (line === text) return;

    event.preventDefault();
    insertLine(line);
    syncDraft();
  };

  /**
   * A drop into the grid's own editor, which no listener can place before it
   * lands. A drop selects the text it put in, which goes in again as one line;
   * where an engine selects nothing, each break becomes a space where it is.
   */
  const dropLine = () => {
    const { textarea } = host;
    const { value, selectionStart, selectionEnd } = textarea;
    const dropped = value.slice(selectionStart, selectionEnd);

    if (CELL_BREAK.test(dropped)) {
      insertLine(oneLine(dropped));
    } else if (CELL_BREAK.test(value)) {
      textarea.value = normalizeCellText(value);
      textarea.setSelectionRange(selectionEnd, selectionEnd);
    }
  };

  /** The selected ranges held to the cells the grid has now, which fewer rows or columns may have left a selection past. */
  const heldRanges = () =>
    rangesInGrid(host.selection().ranges, {
      rowCount: scene.state.rowCount,
      colCount: host.columns().length,
    });

  /** Empties every selected cell the host lets the grid write, as one commit. */
  const clear = () => {
    const ranges = heldRanges();
    if (cellCount(ranges) > CELL_LIMIT) {
      host.reject({ reason: 'too-many-cells' });
      return;
    }

    const writes = fillTargets(ranges, '');
    const { changes } = writableChanges(writes, source());

    if (changes.length > 0) host.commit({ changes, source: 'clear' });
  };

  /**
   * Selects the block a paste of several cells wrote from the active cell, as
   * a spreadsheet does, cut at the last column and past the last row for the
   * host to add. A one-cell clipboard filled the ranges and keeps them.
   */
  const selectPasted = (
    selection: GridSelection,
    matrix: readonly (readonly string[])[]
  ) => {
    let width = 0;
    for (const row of matrix) width = Math.max(width, row.length);
    if (matrix.length === 1 && width === 1) return;

    const { row, col } = selection.active;
    const endCol = Math.min(col + width, host.columns().length) - 1;
    if (endCol < col) return;

    const next: GridSelection = {
      active: { row, col },
      ranges: [
        {
          startRow: row,
          startCol: col,
          endRow: row + matrix.length - 1,
          endCol,
        },
      ],
    };
    if (!selectionEquals(selection, next)) host.select(next);
  };

  /** Whether the column of the active cell brings its own editor. */
  const activeIsCustom = () =>
    typeof host.columns()[host.selection().active.col]?.editor === 'function';

  return {
    view,

    editing: () => edit.status === 'editing',

    holdsFocus: () => customEditorOpen() && focusInSlot(),

    act(action, key) {
      switch (action.type) {
        case 'edit':
          open(host.selection().active, {
            kind: key === 'F2' ? 'f2' : 'enter',
          });
          return;
        case 'clear':
          clear();
          return;
        case 'commit':
          // A column's own editor commits itself; Enter or Tab in the
          // textarea beside it does nothing.
          if (!ownEditorOpen()) return;

          syncDraft();
          finish(commitEdit(edit));
          host.move(action.key, action.mods);
          return;
        case 'cancel':
          close('escape');
      }
    },

    doubleClick(cell) {
      if (!composing) open(cell, { kind: 'doubleClick' });
    },

    beforeinput(event) {
      const { inputType } = event;
      const own = ownEditorOpen();

      // A modified Return in Safari, or a menu, asks for a line break that no
      // keydown the grid sees names; the editor holds one line, as the cell.
      if (LINE_INPUTS.has(inputType)) {
        event.preventDefault();
      } else if (inputType === 'historyUndo') {
        // One history serves every edit of the textarea, so an undo past the
        // open edit's start, or with none open, would bring another's text.
        if (!own || host.textarea.value === undoFloor) event.preventDefault();
        else redos++;
      } else if (inputType === 'historyRedo') {
        if (!own || redos === 0) event.preventDefault();
        else redos--;
      }
    },

    input(event) {
      const { inputType, isComposing } = event as InputEvent;

      if (edit.status === 'editing') {
        if (edit.custom) {
          clearText();
          return;
        }
        if (inputType === 'insertFromDrop') dropLine();
        // An input of its own starts a new history step, past which no redo goes.
        if (!HISTORY.test(inputType)) redos = 0;
        syncDraft();
        return;
      }
      // A composition opened its edit as it started, or opens one or drops
      // its text as it ends.
      if (composing || isComposing) return;
      // An undo no beforeinput reached, as a script's execCommand, brings back
      // another edit's text, which opens nothing.
      if (HISTORY.test(inputType)) {
        clearText();
        return;
      }

      const text = host.textarea.value;
      if (
        isTypedLine(text) &&
        open(host.selection().active, { kind: 'type', text })
      ) {
        return;
      }

      clearText();
    },

    compositionstart() {
      composing = true;
      if (edit.status === 'editing') return;

      // A column's own editor cannot take over a composition in the
      // textarea, so it opens with the composed text once it ends.
      if (activeIsCustom()) {
        const { row, col } = host.selection().active;
        deferred = { row, col };
        return;
      }

      open(host.selection().active, { kind: 'type', text: '' });
    },

    compositionend() {
      composing = false;
      if (edit.status === 'editing') {
        if (edit.custom) clearText();
        else syncDraft();
        return;
      }

      // The composed text goes to the cell it was typed on alone: once the
      // active cell has moved, or its column lost its editor, it is dropped.
      const text = host.textarea.value;
      const cell = deferred;
      const { active } = host.selection();
      const opens =
        cell !== null &&
        cell.row === active.row &&
        cell.col === active.col &&
        activeIsCustom() &&
        isTypedLine(text);
      deferred = null;
      clearText();
      if (opens) open(active, { kind: 'type', text });
    },

    copy(event) {
      const data = event.clipboardData;
      if (!data || ownEditorOpen()) return;

      event.preventDefault();
      const ranges = heldRanges();
      // No cell left to copy puts nothing on the clipboard, as a refused copy.
      if (ranges.length === 0) return;

      const area = copyableRanges(ranges);
      if (!area) {
        host.reject({ reason: 'multi-range-copy' });
        return;
      }
      if (areaCellCount(area) > CELL_LIMIT) {
        host.reject({ reason: 'too-many-cells' });
        return;
      }

      // The getter runs outside the catch, so an error of its own, a
      // RangeError included, reaches the host as it would from a draw.
      const rows = copyRows(area, scene.state.getCell);
      let text: string;
      try {
        text = serialize(rows);
      } catch (error) {
        // A text that outgrows the longest string the engine holds copies
        // nothing, as a refused copy puts nothing on the clipboard.
        if (error instanceof RangeError) return;
        throw error;
      }
      data.setData('text/plain', text);
    },

    paste(event) {
      const data = event.clipboardData;
      if (!data) return;
      if (ownEditorOpen()) {
        pasteLine(event, data.getData('text/plain'));
        return;
      }

      // Unprevented, the text would land in the textarea and open an edit.
      event.preventDefault();
      if (customEditorOpen()) return;

      const matrix = parse(data.getData('text/plain'));
      if (matrix.length === 0) return;

      const selection = host.selection();
      if (pasteCellCount(selection, matrix) > CELL_LIMIT) {
        host.reject({ reason: 'too-many-cells' });
        return;
      }

      const { changes, beyondColumns } = writableChanges(
        pasteTargets(selection, matrix),
        source()
      );
      if (changes.length > 0) host.commit({ changes, source: 'paste' });
      if (beyondColumns) host.reject({ reason: 'paste-beyond-columns' });
      selectPasted(selection, matrix);
    },

    blur() {
      const { textarea } = host;
      if (!ownEditorOpen()) return;

      // A window losing the focus leaves the textarea the active element, and
      // an unmount blurs it as it takes it out; neither ends the edit, so the
      // blur is read once the removal is done.
      const own = generation;
      queueMicrotask(() => {
        const root = textarea.getRootNode() as Document | ShadowRoot;
        if (own !== generation || !textarea.isConnected) return;
        if (root.activeElement !== textarea) close('outside');
      });
    },

    slotKeydown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // WebKit sends the key that ends a composition after compositionend,
      // isComposing false and key code 229, which keyAction holds as well.
      if (event.isComposing || event.keyCode === 229) return;
      if (!customEditorOpen()) return;

      event.preventDefault();
      close('escape');
    },

    slotBlur(event) {
      slotBlur = event;
    },

    dispose() {
      dropEdit();
    },
  };
}
