import { beforeMount, observable, watch } from '@vuerd/lit-observable';
import * as R from 'ramda';

import { markToHTML } from '@/core/helper/dom.helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { databaseHints } from '@/core/sql/dataType';
import { ColumnDataTypeEditorProps } from '@/extensions/panels/grid/components/grid/ColumnDataTypeEditor';

import { useContext } from './context.hook';

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

export function useDataTypeHint(
  props: ColumnDataTypeEditorProps,
  ctx: HTMLElement
) {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const state = observable<HintState>({
    hints: [],
    isFilter: true,
  });

  const getDataTypeHints = () => {
    const {
      store: { canvasState },
    } = contextRef.value.api;
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
                  'vuerd-grid-column-data-type-hint-mark',
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
    activeEnd();
    state.isFilter = false;
    props.value = hint.name;
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
    props.value = state.hints[index].name;
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
    const el = event.target as HTMLInputElement;
    props.value = el.value;
    state.isFilter = true;
  };

  beforeMount(() => {
    const {
      store: { canvasState },
    } = contextRef.value.api;

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
