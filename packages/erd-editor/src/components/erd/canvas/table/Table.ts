import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Column from '@/components/erd/canvas/table/column/Column';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import {
  editTableAction,
  editTableEndAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/tableColumn/generator.actions';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { query } from '@/utils/collection/query';
import { onPrevent } from '@/utils/domEvent';
import { simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Table.styles';
import { useFocusTable } from './useFocusTable';
import { useMoveTable } from './useMoveTable';

export type TableProps = {
  table: Table;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { hasEdit, hasFocus, hasSelectColumn } = useFocusTable(
    ctx,
    props.table.id
  );
  const { onMoveStart } = useMoveTable(ctx, props);

  const handleAddColumn = () => {
    const { store } = app.value;
    store.dispatch(addColumnAction$(props.table.id));
  };

  const handleRemoveTable = () => {
    const { store } = app.value;
    store.dispatch(removeTableAction$(props.table.id));
  };

  const handleFocus = (focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(focusTableAction({ tableId: props.table.id, focusType }));
  };

  const handleEdit = () => {
    const { store } = app.value;
    store.dispatch(editTableAction());
  };

  const handleEditEnd = () => {
    const { store } = app.value;
    store.dispatch(editTableEndAction());
  };

  const handleInput = (event: InputEvent, focusType: FocusType) => {
    const { store } = app.value;
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    switch (focusType) {
      case FocusType.tableName:
        store.dispatch(
          changeTableNameAction({ id: props.table.id, value: input.value })
        );
        break;
      case FocusType.tableComment:
        store.dispatch(
          changeTableCommentAction({ id: props.table.id, value: input.value })
        );
        break;
    }
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { settings, collections } = store.state;
    const { table } = props;
    const selected = Boolean(store.state.editor.selectedMap[table.id]);
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    return html`
      <div
        class=${['table', styles.root]}
        style=${{
          top: `${table.ui.y}px`,
          left: `${table.ui.x}px`,
          'z-index': `${table.ui.zIndex}`,
          width: `${tableWidths.width}px`,
          height: `${height}px`,
        }}
        ?data-selected=${selected}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class=${styles.header}>
          <div
            class=${['table-header-color', styles.headerColor]}
            style=${{
              'background-color': table.ui.color,
            }}
          ></div>
          <div class=${styles.headerButtonWrap}>
            <${Icon}
              size=${12}
              name="plus"
              title=${simpleShortcutToString(
                keyBindingMap.addColumn[0]?.shortcut
              )}
              useTransition=${true}
              .onClick=${handleAddColumn}
            />
            <${Icon}
              size=${12}
              name="xmark"
              title=${simpleShortcutToString(
                keyBindingMap.removeTable[0]?.shortcut
              )}
              useTransition=${true}
              .onClick=${handleRemoveTable}
            />
          </div>
          <div class=${styles.headerInputWrap}>
            <div
              class="input-padding"
              @mousedown=${() => {
                handleFocus(FocusType.tableName);
              }}
              @dblclick=${handleEdit}
            >
              <${EditInput}
                placeholder="table"
                width=${table.ui.widthName}
                value=${table.name}
                focus=${hasFocus(FocusType.tableName)}
                edit=${hasEdit(FocusType.tableName)}
                autofocus=${true}
                .onBlur=${handleEditEnd}
                .onInput=${(event: InputEvent) => {
                  handleInput(event, FocusType.tableName);
                }}
              />
            </div>
            ${bHas(settings.show, SchemaV3Constants.Show.tableComment)
              ? html`
                  <div
                    class="input-padding"
                    @mousedown=${() => {
                      handleFocus(FocusType.tableComment);
                    }}
                    @dblclick=${handleEdit}
                  >
                    <${EditInput}
                      placeholder="comment"
                      width=${table.ui.widthComment}
                      value=${table.comment}
                      focus=${hasFocus(FocusType.tableComment)}
                      edit=${hasEdit(FocusType.tableComment)}
                      autofocus=${true}
                      .onBlur=${handleEditEnd}
                      .onInput=${(event: InputEvent) => {
                        handleInput(event, FocusType.tableComment);
                      }}
                    />
                  </div>
                `
              : null}
          </div>
        </div>
        <div @dragenter=${onPrevent} @dragover=${onPrevent}>
          ${repeat(
            columns,
            column => column.id,
            column =>
              html`
                <${Column}
                  column=${column}
                  selected=${hasSelectColumn(column.id)}
                  widthName=${tableWidths.name}
                  widthDataType=${tableWidths.dataType}
                  widthDefault=${tableWidths.default}
                  widthComment=${tableWidths.comment}
                  focusName=${hasFocus(FocusType.columnName, column.id)}
                  focusDataType=${hasFocus(FocusType.columnDataType, column.id)}
                  focusNotNull=${hasFocus(FocusType.columnNotNull, column.id)}
                  focusDefault=${hasFocus(FocusType.columnDefault, column.id)}
                  focusComment=${hasFocus(FocusType.columnComment, column.id)}
                  focusUnique=${hasFocus(FocusType.columnUnique, column.id)}
                  focusAutoIncrement=${hasFocus(
                    FocusType.columnAutoIncrement,
                    column.id
                  )}
                  editName=${hasEdit(FocusType.columnName, column.id)}
                  editDataType=${hasEdit(FocusType.columnDataType, column.id)}
                  editDefault=${hasEdit(FocusType.columnDefault, column.id)}
                  editComment=${hasEdit(FocusType.columnComment, column.id)}
                />
              `
          )}
        </div>
      </div>
    `;
  };
};

export default Table;
