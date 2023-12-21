import { query } from '@dineug/erd-editor-schema';
import { FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Column from '@/components/visualization/table/column/Column';
import { Show } from '@/constants/schema';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

export type TableProps = {
  table: Table;
  columnId: string | null;
  x: number;
  y: number;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const { settings, collections } = store.state;
    const { table, columnId, x, y } = props;
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    return html`
      <div
        class=${['table', styles.root]}
        style=${{
          top: `${y}px`,
          left: `${x}px`,
          width: `${tableWidths.width}px`,
          height: `${height}px`,
          position: 'fixed',
        }}
        data-id=${table.id}
      >
        <div class=${styles.header}>
          <div
            class=${['table-header-color', styles.headerColor]}
            style=${{
              'background-color': table.ui.color,
            }}
          ></div>
          <div class=${styles.headerButtonWrap}></div>
          <div class=${styles.headerInputWrap}>
            <div class="input-padding">
              <${EditInput}
                placeholder="table"
                width=${table.ui.widthName}
                value=${table.name}
              />
            </div>
            ${bHas(settings.show, Show.tableComment)
              ? html`
                  <div class="input-padding">
                    <${EditInput}
                      placeholder="comment"
                      width=${table.ui.widthComment}
                      value=${table.comment}
                    />
                  </div>
                `
              : null}
          </div>
        </div>
        <div>
          ${repeat(
            columns,
            column => column.id,
            column => html`
              <${Column}
                column=${column}
                selected=${column.id === columnId}
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
