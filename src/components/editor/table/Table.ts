import '@/components/editor/Input';

import { Table } from '@@types/engine/store/table.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { keymapOptionToString } from '@/core/keymap';
import { useContext } from '@/core/hooks/context.hook';
import {
  changeTableName,
  changeTableComment,
  selectTable$,
  moveTable,
} from '@/engine/command/table.cmd.helper';

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

  return () => {
    const {
      keymap,
      store: {
        canvasState: { show },
      },
    } = contextRef.value;
    const table = props.table;
    const { ui } = table;
    const keymapAddColumn = keymapOptionToString(keymap.addColumn[0]);
    const keymapRemoveTable = keymapOptionToString(keymap.removeTable[0]);

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
              title=${keymapRemoveTable}
              name="times"
              size="12"
            ></vuerd-icon>
            <vuerd-icon
              class="vuerd-button"
              title=${keymapAddColumn}
              name="plus"
              size="12"
            ></vuerd-icon>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input
              class="vuerd-table-name"
              .width=${table.ui.widthName}
              .value=${table.name}
              placeholder="table"
              @input=${(event: InputEvent) => onInput(event, 'tableName')}
            ></vuerd-input>
            ${show.tableComment
              ? html`
                  <vuerd-input
                    class="vuerd-table-comment"
                    .width=${table.ui.widthComment}
                    .value=${table.comment}
                    placeholder="comment"
                    @input=${(event: InputEvent) =>
                      onInput(event, 'tableComment')}
                  ></vuerd-input>
                `
              : null}
          </div>
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
