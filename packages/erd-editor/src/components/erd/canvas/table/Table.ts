import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
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
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

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

    drag$.subscribe(handleMove);
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
    const { store } = app.value;
    const { settings } = store.state;
    const { table } = props;
    const selected = Boolean(store.state.editor.selectedMap[table.id]);
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

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
        ?selected=${selected}
        @mousedown=${handleMoveStart}
        @touchstart=${handleMoveStart}
      >
        <div class=${styles.header}>
          <div
            class=${styles.headerColor}
            style=${{
              'background-color': table.ui.color,
            }}
          ></div>
          <div class=${styles.headerButtonWrap}>
            <${Icon}
              size=${12}
              name="plus"
              useTransition=${true}
              .onClick=${handleAddColumn}
            />
            <${Icon}
              size=${12}
              name="xmark"
              useTransition=${true}
              .onClick=${handleRemoveTable}
            />
          </div>
          <div class=${styles.headerInputWrap}>
            <${EditInput}
              placeholder="table"
              width=${table.ui.widthName}
              value=${table.name}
              focus=${true}
              edit=${true}
            />
            ${bHas(settings.show, SchemaV3Constants.Show.tableComment)
              ? html`
                  <${EditInput}
                    placeholder="comment"
                    width=${table.ui.widthComment}
                    value=${table.comment}
                    focus=${true}
                  />
                `
              : null}
          </div>
        </div>
        <div>
          <!-- columns -->
        </div>
      </div>
    `;
  };
};

export default Table;
