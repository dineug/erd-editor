import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Column from '@/components/erd/canvas/table/column/Column';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  removeTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/tableColumn/generator.actions';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { query } from '@/utils/collection/query';
import { onPrevent } from '@/utils/domEvent';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod, simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Table.styles';

export type TableProps = {
  table: Table;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    store.dispatch(moveAllAction$(movementX, movementY));
  };

  const handleMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(selectTableAction$(props.table.id, isMod(event)));

    if (
      !el.closest('.table-header-color') &&
      !el.closest('.column-row') &&
      !el.closest('.icon') &&
      !el.closest('.edit-input')
    ) {
      drag$.subscribe(handleMove);
    }
  };

  const handleAddColumn = () => {
    const { store } = app.value;
    store.dispatch(addColumnAction$(props.table.id));
  };

  const handleRemoveTable = () => {
    const { store } = app.value;
    store.dispatch(removeTableAction$(props.table.id));
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
        @mousedown=${handleMoveStart}
        @touchstart=${handleMoveStart}
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
            <${EditInput}
              placeholder="table"
              width=${table.ui.widthName}
              value=${table.name}
            />
            ${bHas(settings.show, SchemaV3Constants.Show.tableComment)
              ? html`
                  <${EditInput}
                    placeholder="comment"
                    width=${table.ui.widthComment}
                    value=${table.comment}
                  />
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
                  widthName=${tableWidths.name}
                  widthDataType=${tableWidths.dataType}
                  widthDefault=${tableWidths.default}
                  widthComment=${tableWidths.comment}
                />
              `
          )}
        </div>
      </div>
    `;
  };
};

export default Table;
