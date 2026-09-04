import { observable, onMounted, Ref, watch } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { isEmpty } from 'es-toolkit/compat';
import Fues from 'fuse.js';

import { AppContext } from '@/components/appContext';
import { DatabaseHintMap, DataTypeHint } from '@/constants/sql/dataType';
import { changeColumnDataTypeAction$ } from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
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
    const newValue = value.trim();

    state.index = -1;
    state.hints = isEmpty(newValue)
      ? []
      : new Fues(hints, {
          keys: ['name'],
        })
          .search(newValue)
          .map(result => result.item);
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
