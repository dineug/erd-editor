import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  queryAll,
  updated,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';

import { FlipAnimation } from '@/core/flipAnimation';
import { cloneDeep, getData } from '@/core/helper';
import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { fromShadowDraggable } from '@/core/observable/fromShadowDraggable';
import {
  changeIndexColumnOrderType,
  moveIndexColumn,
  removeIndexColumn,
} from '@/engine/command/index.cmd.helper';
import {
  Column,
  Index,
  OrderType,
  Table,
} from '@@types/engine/store/table.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-index-column': IndexColumnElement;
  }
}

export interface IndexColumnProps {
  table: Table;
  indexId: string;
}

export interface IndexColumnElement extends IndexColumnProps, HTMLElement {}

interface IndexColumn extends Column {
  orderType: OrderType;
}

interface IndexModel {
  id: string;
  columns: IndexColumn[];
}

const IndexColumn: FunctionalComponent<IndexColumnProps, IndexColumnElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable({ currentColumnId: '' });
  const columnsRef = queryAll<Array<HTMLElement>>('.vuerd-index-column');
  const columnNamesRef = queryAll<Array<HTMLElement>>(
    '.vuerd-index-column-name'
  );
  const flipAnimation = new FlipAnimation(
    ctx.shadowRoot ? ctx.shadowRoot : ctx,
    '.vuerd-index-column',
    'vuerd-index-column-move'
  );
  const { unmountedGroup } = useUnmounted();
  const { resetTooltip } = useTooltip(['.vuerd-index-column-button'], ctx);

  const getIndex = (): IndexModel | null => {
    const { indexes } = contextRef.value.store.tableState;
    const index = getData(indexes, props.indexId);

    if (!index) return null;

    return {
      id: index.id,
      columns: index.columns
        .map(column => {
          const data = getData(props.table.columns, column.id);
          if (!data) return null;

          const newData = cloneDeep(data) as IndexColumn;
          newData.orderType = column.orderType;
          return newData;
        })
        .filter(column => !!column) as IndexColumn[],
    };
  };

  const onChangeColumnOrderType = (column: IndexColumn) => {
    const { store } = contextRef.value;
    let value: OrderType = 'ASC';
    if (column.orderType === 'ASC') {
      value = 'DESC';
    }
    store.dispatch(changeIndexColumnOrderType(props.indexId, column.id, value));
  };

  const onRemoveColumn = (column: IndexColumn) => {
    const { store } = contextRef.value;
    store.dispatch(removeIndexColumn(props.indexId, column.id));
  };

  const onMoveIndexColumn = (currentId: string, targetId: string) => {
    const { store } = contextRef.value;
    if (currentId === targetId) return;

    flipAnimation.snapshot();
    store.dispatch(moveIndexColumn(props.indexId, currentId, targetId));
  };

  const onDragstart = (currentId: string) => {
    state.currentColumnId = currentId;

    columnNamesRef.value.forEach(el => el.classList.add('none-hover'));

    fromShadowDraggable(columnsRef.value).subscribe({
      next: id => onMoveIndexColumn(currentId, id),
      complete: () => {
        state.currentColumnId = '';
        columnNamesRef.value.forEach(el => el.classList.remove('none-hover'));
      },
    });
  };

  beforeMount(() => {
    const { indexes } = contextRef.value.store.tableState;
    const index = getData(indexes, props.indexId) as Index;

    unmountedGroup.push(watch(index.columns, () => resetTooltip()));
  });

  updated(() => flipAnimation.play());

  return () => {
    const index = getIndex();

    return index
      ? html`
          ${repeat(
            index.columns,
            column => column.id,
            column => html`
              <div
                class=${classMap({
                  'vuerd-index-column': true,
                  draggable: state.currentColumnId === column.id,
                })}
                data-id=${column.id}
                draggable="true"
                @dragstart=${() => onDragstart(column.id)}
              >
                <div class="vuerd-index-column-name">${column.name}</div>
                <div
                  class="vuerd-index-column-order"
                  @click=${() => onChangeColumnOrderType(column)}
                >
                  ${column.orderType}
                </div>
                <div style="display: inline-block;">
                  <vuerd-icon
                    class="vuerd-button vuerd-index-column-button"
                    data-tippy-content="Remove Column"
                    name="times"
                    size="9"
                    @click=${() => onRemoveColumn(column)}
                  ></vuerd-icon>
                </div>
              </div>
            `
          )}
        `
      : null;
  };
};

defineComponent('vuerd-index-column', {
  observedProps: ['table', 'indexId'],
  shadow: false,
  render: IndexColumn,
});
