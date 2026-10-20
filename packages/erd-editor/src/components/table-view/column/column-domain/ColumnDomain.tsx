import { query } from '@dineug/erd-editor-schema';
import { FC, observable, Ref, ref, repeat } from '@dineug/r-html';

import { AppContext, useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import * as styles from '@/components/table-view/column/column-logical-name/ColumnLogicalName.styles';
import { useHintList } from '@/components/table-view/column/useHintList';
import {
  getDomainNames,
  normalizeDictionaryName,
} from '@/engine/modules/dictionary/dictionaryIndex';
import { setColumnDomainAction$ } from '@/engine/modules/dictionary/generator.actions';
import { toLiveDomainId } from '@/engine/modules/dictionary/membership';
import type { RootState } from '@/engine/state';
import { isComposing } from '@/utils/keyboard-shortcut';

export type ColumnDomainProps = {
  app?: Ref<AppContext>;
  tableId: string;
  columnId: string;
  width: number;
  placeholder: string;
  onBlur?: (event: FocusEvent) => void;
  onEditEnd?: () => void;
};

/** A row of the picker: a domain by its id and name, or the empty id that unlinks. */
type DomainOption = {
  id: string;
  name: string;
};

/** The row that links no domain. */
const NONE: DomainOption = { id: '', name: '' };

/**
 * The rows a search offers: every named domain in sheet order after the row
 * that unlinks while nothing is typed, else the domains whose names hold the
 * text in any case; none at all while the sheet lists no named domain.
 */
function searchDomainOptions(state: RootState, typed: string): DomainOption[] {
  const named = getDomainNames(state).rows.flatMap(({ id, name }) => {
    const normalized = normalizeDictionaryName(name);
    return normalized ? [{ id, name: normalized }] : [];
  });

  const key = normalizeDictionaryName(typed).toLowerCase();
  if (!key) return named.length ? [NONE, ...named] : [];

  return named.filter(({ name }) => name.toLowerCase().includes(key));
}

/**
 * The domain editor of a row: a search over the domain sheet by name that only
 * picks, never writing what is typed. A pick links the domain with its type in
 * one dispatch, and None unlinks; it opens on the row of the domain linked.
 */
const ColumnDomain: FC<ColumnDomainProps> = (props, ctx) => {
  const app = useAppContext(ctx, props.app?.value);
  const i18n = useI18n(ctx);
  const state = observable({
    typed: '',
    rows: [] as DomainOption[],
    index: -1,
  });
  const list = useHintList(props, state);

  /** A search lands on its first row, and the empty one on the domain linked. */
  const setRows = (typed: string) => {
    const { store } = app.value;
    const rows = searchDomainOptions(store.state, typed);
    const column = query(store.state.collections)
      .collection('tableColumnEntities')
      .selectById(props.columnId);
    const linkedId = toLiveDomainId(store.state, column?.domainId);
    const linked = typed.trim()
      ? -1
      : rows.findIndex(({ id }) => id === linkedId);

    state.typed = typed;
    state.rows = rows;
    state.index = linked !== -1 ? linked : rows.length ? 0 : -1;
  };

  setRows('');

  const handlePick = (index: number) => {
    const option = state.rows[index];
    if (!option) return;

    const { store } = app.value;
    store.dispatch(
      setColumnDomainAction$(props.tableId, props.columnId, option.id)
    );
    props.onEditEnd?.();
  };

  const handleInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    input && setRows(input.value);
  };

  /** The picker's keys; an IME composition claims the arrows and Enter until it is done. */
  const handleKeydown = (event: KeyboardEvent) => {
    if (isComposing(event)) return;

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
        break;
    }
  };

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
          value={state.typed}
          focus={true}
          edit={true}
          autofocus={true}
          onInput={handleInput}
          onKeydown={handleKeydown}
        />
        {state.rows.length ? (
          <div
            class={['domain-hint', 'scrollbar', styles.hint]}
            use:ref={ref(list.hintList)}
            on:mousedown={list.handleHintMousedown}
            on:touchstart={list.handleHintTouchstart}
            on:wheel={list.handleHintWheel}
          >
            {repeat(
              state.rows,
              option => option.id,
              (option, index) => (
                <div
                  class={[
                    'domain-hint-item',
                    styles.hintItem,
                    { selected: index === selected },
                  ]}
                  on:click={() => handlePick(index)}
                >
                  <span>
                    {option.id === '' ? (
                      i18n.value.t('common.none')
                    ) : (
                      <HighlightedText
                        searchWords={[state.typed.trim()]}
                        textToHighlight={option.name}
                      />
                    )}
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

export default ColumnDomain;
