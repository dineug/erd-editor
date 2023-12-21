import { query } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals, FC, html, repeat } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import * as columnStyles from '@/components/erd/canvas/table/column/Column.styles';
import ColumnDataType from '@/components/erd/canvas/table/column/column-data-type/ColumnDataType';
import ColumnKey from '@/components/erd/canvas/table/column/column-key/ColumnKey';
import ColumnNotNull from '@/components/erd/canvas/table/column/column-not-null/ColumnNotNull';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import EditInput from '@/components/primitives/edit-input/EditInput';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import {
  ColumnOption as ColumnOptionType,
  ColumnType,
  Show,
} from '@/constants/schema';
import {
  addIndexColumnAction$,
  removeIndexColumnAction$,
} from '@/engine/modules/index-column/generator.actions';
import { attachSharedTag$ } from '@/engine/tag';
import { Column, Index } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { calcTableWidths, ColumnWidth } from '@/utils/calcTable';

import * as styles from './IndexesCheckboxColumn.styles';

export type IndexesCheckboxColumnProps = {
  tableId: string;
  index: Index;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const IndexesCheckboxColumn: FC<IndexesCheckboxColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const getColumnOrder = (
    column: Column,
    columnWidth: ColumnWidth
  ): ColumnOrderTpl[] => {
    const { store } = app.value;
    const { settings } = store.state;

    return settings.columnOrder
      .map((columnType: number) => {
        let template: DOMTemplateLiterals | null = null;

        switch (columnType) {
          case ColumnType.columnName:
            template = html`
              <div class="column-col">
                <${EditInput}
                  placeholder="column"
                  width=${columnWidth.name}
                  value=${column.name}
                />
              </div>
            `;
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault)
              ? html`
                  <div class="column-col">
                    <${EditInput}
                      placeholder="default"
                      width=${columnWidth.default}
                      value=${column.default}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnComment:
            template = bHas(settings.show, Show.columnComment)
              ? html`
                  <div class="column-col">
                    <${EditInput}
                      placeholder="comment"
                      width=${columnWidth.comment}
                      value=${column.comment}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnDataType:
            template = bHas(settings.show, Show.columnDataType)
              ? html`
                  <div class="column-col">
                    <${ColumnDataType}
                      tableId=${column.tableId}
                      columnId=${column.id}
                      width=${columnWidth.dataType}
                      value=${column.dataType}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnNotNull:
            template = bHas(settings.show, Show.columnNotNull)
              ? html`
                  <div class="column-col">
                    <${ColumnNotNull} options=${column.options} />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnUnique:
            template = bHas(settings.show, Show.columnUnique)
              ? html`
                  <div class="column-col">
                    <${ColumnOption}
                      checked=${bHas(column.options, ColumnOptionType.unique)}
                      width=${COLUMN_UNIQUE_WIDTH}
                      text="UQ"
                      title="Unique"
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnAutoIncrement:
            template = bHas(settings.show, Show.columnAutoIncrement)
              ? html`
                  <div class="column-col">
                    <${ColumnOption}
                      checked=${bHas(
                        column.options,
                        ColumnOptionType.autoIncrement
                      )}
                      width=${COLUMN_AUTO_INCREMENT_WIDTH}
                      text="AI"
                      title="Auto Increment"
                    />
                  </div>
                `
              : null;
            break;
        }

        return {
          columnType,
          template,
        };
      })
      .filter(({ template }) => Boolean(template));
  };

  const handleChangeIndexColumn = (event: InputEvent, column: Column) => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const { store } = app.value;
    const action$ = input.checked
      ? addIndexColumnAction$
      : removeIndexColumnAction$;

    store.dispatch(attachSharedTag$(action$(props.index.id, column.id)));
  };

  return () => {
    const { tableId, index } = props;
    const { store } = app.value;
    const { collections } = store.state;

    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return null;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    const tableWidths = calcTableWidths(table, store.state);

    const checkedColumnIds = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(index?.indexColumnIds ?? [])
      .map(indexColumn => indexColumn.columnId);
    const hasChecked = arrayHas(checkedColumnIds);

    return html`
      <div class=${['scrollbar', styles.root]}>
        ${repeat(
          columns,
          column => column.id,
          column => html`
            <div class=${['column-row', columnStyles.root]}>
              <div class="column-col">
                <input
                  type="checkbox"
                  ?disabled=${!index}
                  ?checked=${hasChecked(column.id)}
                  @change=${(event: InputEvent) =>
                    handleChangeIndexColumn(event, column)}
                />
              </div>
              <${ColumnKey} keys=${column.ui.keys} />
              ${repeat(
                getColumnOrder(column, tableWidths),
                ({ columnType }) => columnType,
                ({ template }) => template
              )}
            </div>
          `
        )}
      </div>
    `;
  };
};

export default IndexesCheckboxColumn;
