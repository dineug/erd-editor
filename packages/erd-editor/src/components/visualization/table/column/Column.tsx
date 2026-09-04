import { DOMTemplateLiterals, FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import * as styles from '@/components/table-view/column/Column.styles';
import ColumnDataType from '@/components/table-view/column/column-data-type/ColumnDataType';
import ColumnKey from '@/components/table-view/column/column-key/ColumnKey';
import ColumnNotNull from '@/components/table-view/column/column-not-null/ColumnNotNull';
import ColumnOption from '@/components/table-view/column/column-option/ColumnOption';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import {
  ColumnOption as ColumnOptionType,
  ColumnType,
  Show,
} from '@/constants/schema';
import type { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

export type ColumnProps = {
  column: Column;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const getColumnOrder = (): ColumnOrderTpl[] => {
    const { store } = app.value;
    const { settings } = store.state;
    const { column, widthName, widthDataType, widthDefault, widthComment } =
      props;

    return settings.columnOrder
      .map((columnType: number) => {
        let template: DOMTemplateLiterals | null = null;

        switch (columnType) {
          case ColumnType.columnName:
            template = (
              <div class="column-col">
                <EditInput
                  placeholder="column"
                  width={widthName}
                  value={column.name}
                />
              </div>
            );
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault) ? (
              <div class="column-col">
                <EditInput
                  placeholder="default"
                  width={widthDefault}
                  value={column.default}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnComment:
            template = bHas(settings.show, Show.columnComment) ? (
              <div class="column-col">
                <EditInput
                  placeholder="comment"
                  width={widthComment}
                  value={column.comment}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnDataType:
            template = bHas(settings.show, Show.columnDataType) ? (
              <div class="column-col">
                <ColumnDataType
                  tableId={column.tableId}
                  columnId={column.id}
                  width={widthDataType}
                  value={column.dataType}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnNotNull:
            template = bHas(settings.show, Show.columnNotNull) ? (
              <div class="column-col">
                <ColumnNotNull options={column.options} />
              </div>
            ) : null;
            break;
          case ColumnType.columnUnique:
            template = bHas(settings.show, Show.columnUnique) ? (
              <div class="column-col">
                <ColumnOption
                  checked={bHas(column.options, ColumnOptionType.unique)}
                  width={COLUMN_UNIQUE_WIDTH}
                  text="UQ"
                  title="Unique"
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnAutoIncrement:
            template = bHas(settings.show, Show.columnAutoIncrement) ? (
              <div class="column-col">
                <ColumnOption
                  checked={bHas(column.options, ColumnOptionType.autoIncrement)}
                  width={COLUMN_AUTO_INCREMENT_WIDTH}
                  text="AI"
                  title="Auto Increment"
                />
              </div>
            ) : null;
            break;
        }

        return {
          columnType,
          template,
        };
      })
      .filter(({ template }) => Boolean(template));
  };

  return () => {
    const { column } = props;

    return (
      <div class={['column-row', styles.root]} data-id={column.id}>
        <ColumnKey keys={column.ui.keys} />
        {repeat(
          getColumnOrder(),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
      </div>
    );
  };
};

export default Column;
