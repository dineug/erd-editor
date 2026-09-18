import { observable, onMounted, Ref, watch } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import Fues from 'fuse.js';

import { AppContext } from '@/components/appContext';
import { DatabaseHintMap, DataTypeHint } from '@/constants/sql/dataType';
import { changeColumnDataTypeAction$ } from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { isComposing } from '@/utils/keyboard-shortcut';

export type ColumnCellProps = {
  tableId: string;
  columnId: string;
  edit?: boolean;
  value: string;
  onEditEnd?: () => void;
};

const hasAutocompleteKey = arrayHas([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
]);

/** A character that carries a word of a type name on; anything else ends it. */
const NAME_CHAR = /[a-z0-9_]/;

/**
 * Whether the text has gone past a whole type name into what follows it, as in
 * VARCHAR(255) or BIGINT UNSIGNED, with no name going on from the text itself.
 * A list offered there only covers the rows below with names already left behind.
 */
function isPastTypeName(hints: DataTypeHint[], value: string): boolean {
  const typed = value.trimStart().toLowerCase();
  const names = hints.map(hint => hint.name.toLowerCase());

  return (
    !names.some(name => name.startsWith(typed)) &&
    names.some(
      name =>
        typed.length > name.length &&
        typed.startsWith(name) &&
        !NAME_CHAR.test(typed[name.length])
    )
  );
}

/**
 * The hints a typed data type offers: a fuzzy match over the names, or none
 * for blank text and for text that has gone past a whole name.
 */
export function searchDataTypeHints(
  hints: DataTypeHint[],
  value: string
): DataTypeHint[] {
  const newValue = value.trim();

  return isEmpty(newValue) || isPastTypeName(hints, value)
    ? []
    : new Fues(hints, {
        keys: ['name'],
      })
        .search(newValue)
        .map(result => result.item);
}

/**
 * Data type autocomplete state and key handling for a column cell, shared by
 * the DOM cell and by the Konva cell that replaces it.
 */
export function useColumnCell(props: ColumnCellProps, app: Ref<AppContext>) {
  const state = observable({
    hints: [] as DataTypeHint[],
    index: -1,
  });
  const { addUnsubscribe } = useUnmounted();

  const setHints = (value: string) => {
    const { store } = app.value;
    const { settings } = store.state;
    const hints = DatabaseHintMap[settings.database] ?? [];

    state.index = -1;
    state.hints = searchDataTypeHints(hints, value);
  };

  const handleSelectHint = (index: number) => {
    const hint = state.hints[index];
    if (!hint) return;

    const { store } = app.value;
    store.dispatch(
      changeColumnDataTypeAction$({
        id: props.columnId,
        tableId: props.tableId,
        value: hint.name,
      })
    );
    setHints('');
  };

  const handleArrowUp = (event: KeyboardEvent) => {
    if (!state.hints.length) return;
    event.preventDefault();

    const index = state.index - 1;
    state.index = index < 0 ? state.hints.length - 1 : index;
  };

  const handleArrowDown = (event: KeyboardEvent) => {
    if (!state.hints.length) return;
    event.preventDefault();

    const index = state.index + 1;
    state.index = index > state.hints.length - 1 ? 0 : index;
  };

  const handleArrowLeft = (event: KeyboardEvent) => {
    state.index = -1;
  };

  const handleArrowRight = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.preventDefault();

    handleSelectHint(state.index);
  };

  const handleTab = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.preventDefault();
    event.stopPropagation();

    handleSelectHint(state.index);
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.stopPropagation();

    handleSelectHint(state.index);
    props.onEditEnd?.();
  };

  const keyMap: Record<string, (event: KeyboardEvent) => void> = {
    ArrowUp: handleArrowUp,
    ArrowDown: handleArrowDown,
    ArrowLeft: handleArrowLeft,
    ArrowRight: handleArrowRight,
    Tab: handleTab,
    Enter: handleEnter,
  };

  /**
   * The autocomplete list's own keys. An IME composition claims the arrows for
   * its candidate window and Enter to settle a syllable, so none of them is the
   * list's until the browser has finished composing.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (isComposing(event) || !hasAutocompleteKey(event.key)) return;

    keyMap[event.key]?.(event);
  };

  onMounted(() => {
    const { store } = app.value;
    const { settings } = store.state;

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName !== 'edit') return;
        !props.edit && setHints('');
      }),
      watch(settings).subscribe(propName => {
        if (propName !== 'database') return;
        setHints(props.value);
      })
    );
  });

  return {
    state,
    setHints,
    handleSelectHint,
    handleKeydown,
  };
}
