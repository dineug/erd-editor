import type { EditorContext } from '@dineug/grid';
import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
  repeat,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import {
  type DomainOption,
  searchDomainOptions,
} from '@/components/table-view/column/column-domain/domainOptions';
import { normalizeDictionaryName } from '@/engine/modules/dictionary/dictionaryIndex';
import { isComposing } from '@/utils/keyboard-shortcut';

import * as styles from './DomainCellEditor.styles';

export type DomainCellEditorProps = {
  editor: EditorContext;
  /** The column's header, which names the search field. */
  label: string;
  /** Takes the picker out of the slot once its edit has closed. */
  onClose: () => void;
};

/** The domains the list shows before it scrolls, and the room it keeps from the grid's edges. */
const MAX_OPTIONS = 8;
const EDGE = 4;

/** Where the list sits once it opens above the cell, in place of below it. */
const ABOVE = {
  top: 'auto',
  bottom: '100%',
  marginTop: '0',
  marginBottom: '2px',
};

/**
 * A term's domain cell editor: a search over the domain sheet by name that only
 * picks, as the ERD tab's domain cell does. A pick commits the domain's name,
 * which the sheet's commit reads back to its id, and None commits no text.
 */
const DomainCellEditor: FC<DomainCellEditorProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { editor } = props;
  const inputRef = createRef<HTMLInputElement>();
  const listRef = createRef<HTMLDivElement>();
  const state = observable({
    typed: '',
    rows: [] as DomainOption[],
    index: -1,
    above: false,
    maxHeight: styles.OPTION_HEIGHT * MAX_OPTIONS,
  });

  /** A search lands on its first row, and the empty one on the domain the cell showed. */
  const setRows = (typed: string) => {
    const rows = searchDomainOptions(app.value.store.state, typed);
    const shown = normalizeDictionaryName(editor.initialValue);
    const linked = typed.trim()
      ? -1
      : rows.findIndex(({ id, name }) => (id ? name : '') === shown);

    state.typed = typed;
    state.rows = rows;
    state.index = linked !== -1 ? linked : rows.length ? 0 : -1;
  };

  setRows(editor.mode === 'replace' ? editor.initialValue : '');

  let closed = false;
  const close = (option: DomainOption | null) => {
    if (closed) return;
    closed = true;

    if (option) editor.commit(option.id ? option.name : '');
    else editor.cancel();
    props.onClose();
  };

  // Only a pick writes, so Escape and a press outside leave the text typed unwritten.
  editor.onClose(() => close(null));

  const revealSelected = () => {
    listRef.value
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  };

  /** The keyboard row one step up or down, round either end. */
  const step = (delta: 1 | -1) => {
    const { length } = state.rows;
    if (!length) return;

    const index = state.index + delta;
    state.index = index < 0 ? length - 1 : index >= length ? 0 : index;
    nextTick(revealSelected);
  };

  const handleInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    if (input) setRows(input.value);
  };

  /** The picker's keys; a composition keeps the arrows and Enter until it ends. */
  const handleKeydown = (event: KeyboardEvent) => {
    if (isComposing(event)) return;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        step(event.key === 'ArrowUp' ? -1 : 1);
        break;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        if (state.index !== -1) close(state.rows[state.index]);
        else if (event.key === 'Tab') close(null);
        break;
    }
  };

  /** A press on the list keeps the caret in the search field. */
  const keepFocus = (event: MouseEvent) => event.preventDefault();

  /** Below the cell while the list fits there or more room is below, else above, kept inside the grid. */
  const place = () => {
    const area = editor.container.parentElement;
    if (!area) return;

    const { top, bottom } = editor.rect;
    const full = styles.OPTION_HEIGHT * MAX_OPTIONS + 2;
    const below = area.clientHeight - bottom - EDGE;
    const above = top - EDGE;

    state.above = below < full && above > below;
    state.maxHeight = Math.max(
      styles.OPTION_HEIGHT,
      Math.min(full, state.above ? above : below)
    );
  };

  onMounted(() => {
    place();
    inputRef.value?.focus({ preventScroll: true });
    nextTick(revealSelected);
  });

  return () => {
    const selected = state.index;

    return (
      <div class={['dictionary-domain-editor', styles.root]} prop:dir="ltr">
        <input
          class={styles.input}
          use:ref={ref(inputRef)}
          type="text"
          spellcheck="false"
          autocomplete="off"
          aria-label={props.label}
          placeholder={props.label}
          prop:value={state.typed}
          on:input={handleInput}
          on:keydown={handleKeydown}
        />
        {state.rows.length ? (
          <div
            class={['scrollbar', styles.list]}
            use:ref={ref(listRef)}
            role="listbox"
            aria-label={props.label}
            style={{
              maxHeight: `${state.maxHeight}px`,
              ...(state.above ? ABOVE : {}),
            }}
            on:mousedown={keepFocus}
          >
            {repeat(
              state.rows,
              option => option.id,
              (option, index) => (
                <div
                  class={styles.option}
                  role="option"
                  aria-selected={String(index === selected)}
                  on:click={() => close(option)}
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

export default DomainCellEditor;
