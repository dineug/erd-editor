import { Table } from '@@types/engine/store/table.state';
import { observable, watch, beforeMount, query } from '@vuerd/lit-observable';
import * as R from 'ramda';
import { useContext } from './context.hook';
import { useUnmounted } from './unmounted.hook';
import { markToHTML, lastCursorFocus } from '@/core/helper/dom.helper';
import { getData } from '@/core/helper';
import { moveCanvas } from '@/engine/command/canvas.cmd.helper';
import { selectTable } from '@/engine/command/table.cmd.helper';
import { SIZE_START_X, SIZE_START_Y } from '@/core/layout';

export interface Hint {
  id: string;
  name: string;
  html: string;
  active: boolean;
}

export interface HintState {
  value: string;
  hints: Hint[];
  isFilter: boolean;
  focus: boolean;
}

const findIndex = R.findIndex(R.propEq('active', true));

export function useTableHint(ctx: HTMLElement) {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const state = observable<HintState>({
    value: '',
    hints: [],
    isFilter: true,
    focus: false,
  });
  const inputRef = query<HTMLInputElement>('input');

  const getActiveIndex = () => findIndex(state.hints);

  const setHints = () => {
    if (!state.isFilter) return;

    const {
      store: {
        tableState: { tables },
      },
    } = contextRef.value;

    state.hints =
      state.value.trim().length < 1
        ? []
        : tables
            .filter(
              table =>
                table.name.toLowerCase().indexOf(state.value.toLowerCase()) !==
                -1
            )
            .map(column => {
              return {
                id: column.id,
                name: column.name,
                html: markToHTML(
                  'vuerd-find-table-hint-mark',
                  column.name,
                  state.value
                ),
                active: false,
              };
            });
  };

  const activeEnd = () => {
    state.hints.forEach(hint => (hint.active = false));
  };

  const moveCanvasFindTable = (table: Table) => {
    const { store } = contextRef.value;

    store.dispatch(
      moveCanvas(
        (table.ui.top - SIZE_START_Y) * -1,
        (table.ui.left - SIZE_START_X) * -1
      ),
      selectTable(store, false, table.id)
    );
  };

  const onSelectHint = (hint: Hint) => {
    activeEnd();
    state.isFilter = false;
    lastCursorFocus(inputRef.value);

    const { tables } = contextRef.value.store.tableState;
    const table = getData(tables, hint.id);

    if (table) {
      moveCanvasFindTable(table);
    }
  };

  const onArrowUp = (event: KeyboardEvent) => {
    state.hints.length !== 0 && event.preventDefault();
    const index = getActiveIndex();

    if (index > 0) {
      state.hints[index].active = false;
      state.hints[index - 1].active = true;
    } else if (state.hints.length) {
      index === 0 && (state.hints[index].active = false);
      state.hints[state.hints.length - 1].active = true;
    }
  };

  const onArrowDown = (event: KeyboardEvent) => {
    state.hints.length !== 0 && event.preventDefault();
    const index = getActiveIndex();

    if (index !== -1 && index !== state.hints.length - 1) {
      state.hints[index].active = false;
      state.hints[index + 1].active = true;
    } else if (state.hints.length) {
      index === state.hints.length - 1 && (state.hints[index].active = false);
      state.hints[0].active = true;
    }
  };

  const onArrowLeft = () => activeEnd();

  const onArrowRight = (event: KeyboardEvent) => {
    const index = getActiveIndex();
    if (index < 0) return;
    event.preventDefault();
    state.isFilter = false;

    const { tables } = contextRef.value.store.tableState;
    const table = getData(tables, state.hints[index].id);

    if (table) {
      moveCanvasFindTable(table);
    }
  };

  const arrowMap = {
    ArrowUp: onArrowUp,
    ArrowDown: onArrowDown,
    ArrowLeft: onArrowLeft,
    ArrowRight: onArrowRight,
  };

  const onKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        arrowMap[event.key](event);
        break;
      case 'Enter':
        arrowMap.ArrowRight(event);
        break;
    }
  };

  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    state.value = input.value;
    state.isFilter = true;
  };

  const initHints = () => {
    state.isFilter = true;
    setHints();
  };

  beforeMount(() =>
    unmountedGroup.push(
      watch(state, propName => {
        if (propName !== 'value') return;

        setHints();
      })
    )
  );

  return {
    hintState: state,
    onSelectHint,
    onKeydown,
    onInput,
    initHints,
  };
}
