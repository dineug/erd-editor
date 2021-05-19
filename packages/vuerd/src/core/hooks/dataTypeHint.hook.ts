import { observable, watch, beforeMount } from '@vuerd/lit-observable';
import * as R from 'ramda';
import { useContext } from './context.hook';
import { useUnmounted } from './unmounted.hook';
import { ColumnDataTypeProps } from '@/components/editor/table/column/ColumnDataType';
import { databaseHints } from '@/core/sql/dataType';
import { markToHTML } from '@/core/helper/dom.helper';
import { changeColumnDataType } from '@/engine/command/column.cmd.helper';

export interface Hint {
  name: string;
  html: string;
  active: boolean;
}

export interface HintState {
  hints: Hint[];
  isFilter: boolean;
}

const findIndex = R.findIndex(R.propEq('active', true));

export function useDataTypeHint(props: ColumnDataTypeProps, ctx: HTMLElement) {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const state = observable<HintState>({
    hints: [],
    isFilter: true,
  });

  const getDataTypeHints = () => {
    const {
      store: { canvasState },
    } = contextRef.value;
    const databaseHint = databaseHints.find(
      databaseHint => databaseHint.database === canvasState.database
    );
    return databaseHint ? databaseHint.dataTypeHints : [];
  };

  const getActiveIndex = () => findIndex(state.hints);

  const setHints = () => {
    if (!state.isFilter) return;

    const dataTypeHints = getDataTypeHints();

    state.hints =
      props.value.trim() === ''
        ? dataTypeHints.map(dataTypeHint => ({
            name: dataTypeHint.name,
            html: dataTypeHint.name,
            active: false,
          }))
        : dataTypeHints
            .filter(
              dataTypeHint =>
                dataTypeHint.name
                  .toLowerCase()
                  .indexOf(props.value.toLowerCase()) !== -1
            )
            .map(dataTypeHint => {
              return {
                name: dataTypeHint.name,
                html: markToHTML(
                  'vuerd-data-type-hint-mark',
                  dataTypeHint.name,
                  props.value
                ),
                active: false,
              };
            });
  };

  const activeEnd = () => {
    state.hints.forEach(hint => (hint.active = false));
  };

  const onSelectHint = (hint: Hint) => {
    const { store, helper } = contextRef.value;
    activeEnd();
    state.isFilter = false;
    store.dispatch(
      changeColumnDataType(helper, props.tableId, props.columnId, hint.name)
    );
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
    const { store, helper } = contextRef.value;

    state.isFilter = false;
    store.dispatch(
      changeColumnDataType(
        helper,
        props.tableId,
        props.columnId,
        state.hints[index].name
      )
    );
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

  const onInput = () => (state.isFilter = true);

  beforeMount(() => {
    const {
      store: { canvasState },
    } = contextRef.value;

    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'value') return;

        setHints();
      }),
      watch(canvasState, propName => {
        if (propName !== 'database') return;

        state.isFilter = true;
        setHints();
      })
    );
  });

  return {
    hintState: state,
    onSelectHint,
    onKeydown,
    onInput,
  };
}
