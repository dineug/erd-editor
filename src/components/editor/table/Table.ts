import '@/components/editor/Input';
import '@/components/editor/table/column/Column';

import { Table } from '@@types/engine/store/table.state';
import { FocusType, TableType } from '@@types/engine/store/editor.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { keymapOptionsToString } from '@/core/keymap';
import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import {
  changeTableName,
  changeTableComment,
  selectTable$,
  moveTable,
  removeTable,
} from '@/engine/command/table.cmd.helper';
import { addColumn$ } from '@/engine/command/column.cmd.helper';
import {
  focusTable,
  editTableEnd,
  editTable,
} from '@/engine/command/editor.cmd.helper';
import {
  isFocus,
  isSelectColumn,
  isEdit,
} from '@/engine/store/helper/editor.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-table': TableElement;
  }
}

export interface TableProps {
  table: Table;
}

export interface TableElement extends TableProps, HTMLElement {}

const Table: FunctionalComponent<TableProps, TableElement> = (props, ctx) => {
  const contextRef = useContext(ctx);
  useTooltip(['.vuerd-button'], ctx);

  const getFocusState = (focusType: FocusType, columnId?: string) => {
    const {
      store: { editorState },
    } = contextRef.value;
    return isFocus(editorState.focusTable, focusType, props.table.id, columnId);
  };

  const getEdit = (focusType: FocusType, columnId?: string) => {
    const {
      store: { editorState },
    } = contextRef.value;
    return isEdit(editorState.focusTable, focusType, props.table.id, columnId);
  };

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
    const { store, globalEvent } = contextRef.value;
    const { drag$ } = globalEvent;

    if (!el.closest('.vuerd-button') && !el.closest('vuerd-input')) {
      drag$.subscribe(onMove);
    }
    if (!el.closest('vuerd-input-edit')) {
      store.dispatch(
        selectTable$(store, event.ctrlKey || event.metaKey, props.table.id)
      );
    }
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

  return () => {
    const {
      keymap,
      store: {
        canvasState: { show },
        editorState,
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
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <vuerd-icon
              class="vuerd-button"
              data-tippy-content=${keymapOptionsToString(keymap.removeTable)}
              name="times"
              size="12"
              @click=${onRemoveTable}
            ></vuerd-icon>
            <vuerd-icon
              class="vuerd-button"
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
              .focusState=${getFocusState('tableName')}
              .edit=${getEdit('tableName')}
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
                    .focusState=${getFocusState('tableComment')}
                    .edit=${getEdit('tableComment')}
                    placeholder="comment"
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
        <div class="vuerd-table-body">
          ${repeat(
            columns,
            column => column.id,
            column =>
              html`
                <vuerd-column
                  .tableId=${table.id}
                  .column=${column}
                  .select=${isSelectColumn(
                    editorState.focusTable,
                    table.id,
                    column.id
                  )}
                  .focusName=${getFocusState('columnName', column.id)}
                  .focusDataType=${getFocusState('columnDataType', column.id)}
                  .focusNotNull=${getFocusState('columnNotNull', column.id)}
                  .focusDefault=${getFocusState('columnDefault', column.id)}
                  .focusComment=${getFocusState('columnComment', column.id)}
                  .focusUnique=${getFocusState('columnUnique', column.id)}
                  .focusAutoIncrement=${getFocusState(
                    'columnAutoIncrement',
                    column.id
                  )}
                  .editName=${getEdit('columnName', column.id)}
                  .editComment=${getEdit('columnComment', column.id)}
                  .editDataType=${getEdit('columnDataType', column.id)}
                  .editDefault=${getEdit('columnDefault', column.id)}
                  .widthName=${widthColumn.name}
                  .widthComment=${widthColumn.comment}
                  .widthDataType=${widthColumn.dataType}
                  .widthDefault=${widthColumn.default}
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
