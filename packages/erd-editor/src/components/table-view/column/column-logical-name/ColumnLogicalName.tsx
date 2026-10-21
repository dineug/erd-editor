import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onUnmounted, Ref, ref, repeat } from '@dineug/r-html';

import { AppContext, useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import { useHintList } from '@/components/table-view/column/useHintList';
import { normalizeDictionaryName } from '@/engine/modules/dictionary/dictionaryIndex';
import {
  deriveColumnNameAction$,
  deriveTableNameAction$,
  setColumnLogicalNameAction$,
  setTableLogicalNameAction$,
} from '@/engine/modules/dictionary/generator.actions';
import {
  completeTerms,
  getTermIndex,
} from '@/engine/modules/dictionary/termIndex';
import type { RootState } from '@/engine/state';
import type { Term } from '@/internal-types';
import { isComposing } from '@/utils/keyboard-shortcut';

import * as styles from './ColumnLogicalName.styles';

export type ColumnLogicalNameProps = {
  app?: Ref<AppContext>;
  tableId: string;
  /** The column whose logical name is edited, null for the table's own. */
  columnId: string | null;
  width: number;
  value: string;
  placeholder: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onEditEnd?: () => void;
};

/** The logical name a table or column the document still lists holds, null once it is gone. */
function heldLogicalName(
  state: RootState,
  tableId: string,
  columnId: string | null
): string | null {
  const { doc, collections } = state;
  if (!doc.tableIds.includes(tableId)) return null;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(tableId);
  if (!table) return null;
  if (columnId === null) return table.logicalName;
  if (!table.columnIds.includes(columnId)) return null;

  return (
    query(collections).collection('tableColumnEntities').selectById(columnId)
      ?.logicalName ?? null
  );
}

/**
 * The logical name editor of a header or a row: each key writes the text, the
 * terms its start names drop under it, and a term picked writes it with its
 * derivation; the name is derived once more as the editor closes on a change.
 */
const ColumnLogicalName: FC<ColumnLogicalNameProps> = (props, ctx) => {
  const app = useAppContext(ctx, props.app?.value);
  const state = observable({ rows: [] as Term[], index: -1 });
  const list = useHintList(props, state);
  const opened = props.value;

  const setRows = (value: string) => {
    const { store } = app.value;
    state.index = -1;
    state.rows = completeTerms(getTermIndex(store.state), value);
  };

  const handlePick = (index: number) => {
    const term = state.rows[index];
    if (!term) return;

    const { store } = app.value;
    const { tableId, columnId } = props;
    const value = normalizeDictionaryName(term.name);
    store.dispatch(
      columnId === null
        ? setTableLogicalNameAction$(tableId, value)
        : setColumnLogicalNameAction$(tableId, columnId, value)
    );
    setRows('');
  };

  const handleInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    input && setRows(input.value);
    props.onInput?.(event);
  };

  /**
   * The list's own keys while it shows. An IME composition claims the arrows
   * and Enter until the browser has finished composing, and Escape closes the
   * list alone, so the stop branch hears only the next one.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (isComposing(event) || !state.rows.length) return;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        list.step(event.key === 'ArrowUp' ? -1 : 1);
        break;
      case 'Enter':
        if (state.index === -1) return;
        event.stopPropagation();
        handlePick(state.index);
        props.onEditEnd?.();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        setRows('');
        break;
    }
  };

  /**
   * Derives the name from the logical name once as the editor closes on one
   * other than it opened with, whatever closed it. A term picked derived it
   * already, so this finds every value held and sends nothing.
   */
  onUnmounted(() => {
    const { store, lifecycle } = app.value;
    if (lifecycle.destroyed) return;

    const { tableId, columnId } = props;
    const held = heldLogicalName(store.state, tableId, columnId);
    if (held === null || held === opened) return;

    store.dispatch(
      columnId === null
        ? deriveTableNameAction$(tableId)
        : deriveColumnNameAction$(tableId, columnId)
    );
  });

  return () => {
    // Read here, since repeat builds each row outside this render and a row
    // reading the selection itself would miss a change.
    const selected = state.index;

    return (
      <div
        class={styles.root}
        use:ref={ref(list.root)}
        prop:dir="ltr"
        tabindex="-1"
        on:focus={list.handleFocus}
        on:focusin={list.handleFocus}
        on:focusout={list.handleFocusout}
      >
        <EditInput
          placeholder={props.placeholder}
          width={props.width}
          value={props.value}
          focus={true}
          edit={true}
          autofocus={true}
          onInput={handleInput}
          onKeydown={handleKeydown}
        />
        {state.rows.length ? (
          <div
            class={['logical-name-hint', 'scrollbar', styles.hint]}
            use:ref={ref(list.hintList)}
            on:mousedown={list.handleHintMousedown}
            on:touchstart={list.handleHintTouchstart}
            on:wheel={list.handleHintWheel}
          >
            {repeat(
              state.rows,
              term => term.id,
              (term, index) => (
                <div
                  class={[
                    'logical-name-hint-item',
                    styles.hintItem,
                    { selected: index === selected },
                  ]}
                  on:click={() => handlePick(index)}
                >
                  <span>
                    <HighlightedText
                      searchWords={[props.value.trim()]}
                      textToHighlight={term.name}
                    />
                  </span>
                  <Kbd mini={true} shortcut="Enter" />
                </div>
              )
            )}
          </div>
        ) : null}
      </div>
    );
  };
};

export default ColumnLogicalName;
