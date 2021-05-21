import '@/components/editor/Input';
import './column/Column';

import { Table } from '@@types/engine/store/table.state';
import { TableType } from '@@types/engine/store/editor.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
  beforeMount,
  updated,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Tween, Easing } from '@tweenjs/tween.js';
import { keymapOptionsToString } from '@/core/keymap';
import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useHasTable } from '@/core/hooks/hasTable.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import {
  changeTableName,
  changeTableComment,
  selectTable$,
  moveTable,
  removeTable,
} from '@/engine/command/table.cmd.helper';
import { addColumn$, moveColumn$ } from '@/engine/command/column.cmd.helper';
import {
  focusTable,
  editTableEnd,
  editTable,
} from '@/engine/command/editor.cmd.helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { FlipAnimation } from '@/core/flipAnimation';
import { relationshipSort } from '@/engine/store/helper/relationship.helper';
import { onPreventDefault } from '@/core/helper/dom.helper';
import { SIZE_TABLE_PADDING, SIZE_TABLE_BORDER } from '@/core/layout';
import { DragoverColumnDetail } from './column/Column';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-table': TableElement;
  }
}

export interface TableProps {
  table: Table;
}

export interface TableElement extends TableProps, HTMLElement {}

const TABLE_PADDING = (SIZE_TABLE_PADDING + SIZE_TABLE_BORDER) * 2;
const ANIMATION_TIME = 300;

const Table: FunctionalComponent<TableProps, TableElement> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { hasFocusState, hasEdit, hasSelectColumn, hasDraggableColumn } =
    useHasTable(props, ctx);
  useTooltip(['.vuerd-table-button'], ctx);
  const { resetTooltip } = useTooltip(['.vuerd-table-comment'], ctx);
  const flipAnimation = new FlipAnimation(
    ctx.shadowRoot ? ctx.shadowRoot : ctx,
    'vuerd-column',
    'vuerd-column-move'
  );
  const draggable$ = new Subject<CustomEvent<DragoverColumnDetail>>();
  const { unmountedGroup } = useUnmounted();
  let leftTween: Tween<{ left: number }> | null = null;
  let topTween: Tween<{ top: number }> | null = null;

  const onInput = (event: InputEvent, focusType: string) => {
    const { store, helper } = contextRef.value;
    const input = event.target as HTMLInputElement;
    switch (focusType) {
      case 'tableName':
        store.dispatch(changeTableName(helper, props.table.id, input.value));
        break;
      case 'tableComment':
        store.dispatch(changeTableComment(helper, props.table.id, input.value));
        break;
    }
  };

  const onMove = ({ event, movementX, movementY }: Move) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = contextRef.value;
    store.dispatch(
      moveTable(
        store,
        event.ctrlKey || event.metaKey,
        movementX,
        movementY,
        props.table.id
      )
    );
  };

  const onMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;
    const { store, globalEvent, eventBus } = contextRef.value;
    const { drag$ } = globalEvent;

    if (!el.closest('.vuerd-button') && !el.closest('vuerd-input')) {
      leftTween?.stop();
      topTween?.stop();

      drag$.subscribe({
        next: onMove,
        complete: () => eventBus.emit(Bus.BalanceRange.move),
      });
    }

    store.dispatch(
      selectTable$(store, event.ctrlKey || event.metaKey, props.table.id)
    );
  };

  const onRemoveTable = () => {
    const { store } = contextRef.value;
    store.dispatch(removeTable(store, props.table.id));
  };

  const onAddColumn = () => {
    const { store } = contextRef.value;
    store.dispatch(addColumn$(store, props.table.id));
  };

  const onFocus = (focusType: TableType) => {
    const { store } = contextRef.value;
    store.dispatch(focusTable(props.table.id, focusType));
  };

  const onBlur = () => {
    const { store } = contextRef.value;
    store.dispatch(editTableEnd());
  };

  const onEdit = () => {
    const { store } = contextRef.value;
    store.dispatch(editTable());
  };

  const onDragoverGroupColumn = (event: CustomEvent<DragoverColumnDetail>) =>
    draggable$.next(event);

  const onDraggableColumn = (event: CustomEvent<DragoverColumnDetail>) => {
    const { store } = contextRef.value;
    const {
      editorState: { draggableColumn },
    } = store;
    const { tableId, columnId } = event.detail;

    if (!draggableColumn || draggableColumn.columnIds.includes(columnId))
      return;

    flipAnimation.snapshot();
    store.dispatch(
      moveColumn$(
        store,
        draggableColumn.tableId,
        draggableColumn.columnIds,
        tableId,
        columnId
      )
    );
  };

  const moveBalance = () => {
    const {
      canvasState: { width, height },
      tableState: { tables },
      relationshipState: { relationships },
    } = contextRef.value.store;
    const minWidth = width - (props.table.width() + TABLE_PADDING);
    const minHeight = height - (props.table.height() + TABLE_PADDING);
    const x = props.table.ui.left > minWidth ? minWidth : 0;
    const y = props.table.ui.top > minHeight ? minHeight : 0;

    if (props.table.ui.left < 0 || props.table.ui.left > minWidth) {
      leftTween = new Tween(props.table.ui)
        .to({ left: x }, ANIMATION_TIME)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => relationshipSort(tables, relationships))
        .onComplete(() => (leftTween = null))
        .start();
    }

    if (props.table.ui.top < 0 || props.table.ui.top > minHeight) {
      topTween = new Tween(props.table.ui)
        .to({ top: y }, ANIMATION_TIME)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => relationshipSort(tables, relationships))
        .onComplete(() => (topTween = null))
        .start();
    }
  };

  updated(() => flipAnimation.play());

  beforeMount(() => {
    const {
      eventBus,
      store: {
        canvasState: { show },
      },
    } = contextRef.value;

    unmountedGroup.push(
      draggable$.pipe(debounceTime(50)).subscribe(onDraggableColumn),
      eventBus.on(Bus.BalanceRange.move).subscribe(moveBalance),
      watch(props.table, propName => {
        if (propName !== 'comment') return;

        resetTooltip();
      }),
      watch(show, propName => {
        if (propName !== 'tableComment') return;

        resetTooltip();
      })
    );
  });

  return () => {
    const {
      keymap,
      store: {
        canvasState: { show },
      },
    } = contextRef.value;
    const { table } = props;
    const { ui, columns } = table;
    const widthColumn = table.maxWidthColumn();

    return html`
      <div
        class=${classMap({
          'vuerd-table': true,
          active: ui.active,
        })}
        style=${styleMap({
          top: `${ui.top}px`,
          left: `${ui.left}px`,
          zIndex: `${ui.zIndex}`,
          width: `${table.width()}px`,
          height: `${table.height()}px`,
        })}
        data-id=${table.id}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <vuerd-icon
              class="vuerd-button vuerd-table-button"
              data-tippy-content=${keymapOptionsToString(keymap.removeTable)}
              name="times"
              size="12"
              @click=${onRemoveTable}
            ></vuerd-icon>
            <vuerd-icon
              class="vuerd-button vuerd-table-button"
              data-tippy-content=${keymapOptionsToString(keymap.addColumn)}
              name="plus"
              size="12"
              @click=${onAddColumn}
            ></vuerd-icon>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input
              class="vuerd-table-name"
              .width=${table.ui.widthName}
              .value=${table.name}
              .focusState=${hasFocusState('tableName')}
              .edit=${hasEdit('tableName')}
              placeholder="table"
              @input=${(event: InputEvent) => onInput(event, 'tableName')}
              @mousedown=${() => onFocus('tableName')}
              @dblclick=${onEdit}
              @vuerd-input-blur=${onBlur}
            ></vuerd-input>
            ${show.tableComment
              ? html`
                  <vuerd-input
                    class="vuerd-table-comment"
                    .width=${table.ui.widthComment}
                    .value=${table.comment}
                    .focusState=${hasFocusState('tableComment')}
                    .edit=${hasEdit('tableComment')}
                    placeholder="comment"
                    data-tippy-content=${table.comment.trim()
                      ? table.comment
                      : 'comment'}
                    @input=${(event: InputEvent) =>
                      onInput(event, 'tableComment')}
                    @mousedown=${() => onFocus('tableComment')}
                    @dblclick=${onEdit}
                    @vuerd-input-blur=${onBlur}
                  ></vuerd-input>
                `
              : null}
          </div>
        </div>
        <div
          class="vuerd-table-body"
          @dragenter=${onPreventDefault}
          @dragover=${onPreventDefault}
        >
          ${repeat(
            columns,
            column => column.id,
            column =>
              html`
                <vuerd-column
                  .tableId=${table.id}
                  .column=${column}
                  .select=${hasSelectColumn(column.id)}
                  .draggable=${hasDraggableColumn(column.id)}
                  .focusName=${hasFocusState('columnName', column.id)}
                  .focusDataType=${hasFocusState('columnDataType', column.id)}
                  .focusNotNull=${hasFocusState('columnNotNull', column.id)}
                  .focusDefault=${hasFocusState('columnDefault', column.id)}
                  .focusComment=${hasFocusState('columnComment', column.id)}
                  .focusUnique=${hasFocusState('columnUnique', column.id)}
                  .focusAutoIncrement=${hasFocusState(
                    'columnAutoIncrement',
                    column.id
                  )}
                  .editName=${hasEdit('columnName', column.id)}
                  .editComment=${hasEdit('columnComment', column.id)}
                  .editDataType=${hasEdit('columnDataType', column.id)}
                  .editDefault=${hasEdit('columnDefault', column.id)}
                  .widthName=${widthColumn.name}
                  .widthComment=${widthColumn.comment}
                  .widthDataType=${widthColumn.dataType}
                  .widthDefault=${widthColumn.default}
                  @dragover-column=${onDragoverGroupColumn}
                ></vuerd-column>
              `
          )}
        </div>
      </div>
    `;
  };
};

defineComponent('vuerd-table', {
  observedProps: ['table'],
  shadow: false,
  render: Table,
});
