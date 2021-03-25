import { observable, watch, beforeMount, query } from '@dineug/lit-observable';
import * as R from 'ramda';
import { useContext } from './context.hook';
import { useUnmounted } from './unmounted.hook';
import { IndexAddColumnProps } from '@/components/drawer/tablePropertiesDrawer/indexes/IndexAddColumn';
import { markToHTML, lastCursorFocus } from '@/core/helper/dom.helper';
import { getData } from '@/core/helper';
import { addIndexColumn } from '@/engine/command/index.cmd.helper';

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

export function useColumnTypeHint(
  props: IndexAddColumnProps,
  ctx: HTMLElement
) {
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

    const columns = props.table.columns;

    state.hints =
      state.value.trim().length < 1
        ? []
        : columns
            .filter(
              column =>
                column.name.toLowerCase().indexOf(state.value.toLowerCase()) !==
                -1
            )
            .map(column => {
              return {
                id: column.id,
                name: column.name,
                html: markToHTML('vuerd-mark', column.name, state.value),
                active: false,
              };
            });
  };

  const activeEnd = () => {
    state.hints.forEach(hint => (hint.active = false));
  };

  const onSelectHint = (hint: Hint) => {
    const { store } = contextRef.value;
    const { indexes } = store.tableState;
    const columns = props.table.columns;
    activeEnd();
    state.isFilter = false;
    lastCursorFocus(inputRef.value);
    const indexModel = getData(indexes, props.indexId);
    const targetColumn = getData(columns, hint.id);
    if (
      targetColumn &&
      indexModel &&
      !indexModel.columns.some(column => column.id === targetColumn.id)
    ) {
      store.dispatch(addIndexColumn(props.indexId, targetColumn.id));
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
    const { store } = contextRef.value;
    const { indexes } = store.tableState;
    const columns = props.table.columns;
    state.isFilter = false;
    const indexModel = getData(indexes, props.indexId);
    const targetColumn = getData(columns, state.hints[index].id);
    if (
      targetColumn &&
      indexModel &&
      !indexModel.columns.some(column => column.id === targetColumn.id)
    ) {
      store.dispatch(addIndexColumn(props.indexId, targetColumn.id));
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
    }
  };

  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    state.value = input.value;
    state.isFilter = true;
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
  };
}
