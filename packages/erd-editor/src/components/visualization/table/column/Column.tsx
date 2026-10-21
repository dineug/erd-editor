import { DOMTemplateLiterals, FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import * as styles from '@/components/table-view/column/Column.styles';
import ColumnDataType from '@/components/table-view/column/column-data-type/ColumnDataType';
import ColumnKey from '@/components/table-view/column/column-key/ColumnKey';
import ColumnNotNull from '@/components/table-view/column/column-not-null/ColumnNotNull';
import ColumnOption from '@/components/table-view/column/column-option/ColumnOption';
import {
  domainCellText,
  logicalNameCellText,
  nameCellText,
  typeCellText,
} from '@/components/table-view/column/columnViewText';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import {
  ColumnOption as ColumnOptionType,
  ColumnType,
  Show,
} from '@/constants/schema';
import { isBothNameView } from '@/engine/modules/editor/utils/nameView';
import type { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

export type ColumnProps = {
  column: Column;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
  /** The logical name's own cell, which the view of both names alone lays out. */
  widthLogicalName?: number;
  /** The domain's own cell, laid out while its show bit is set. */
  widthDomain?: number;
  /** The room the table keeps for alternate key marks, 0 while it draws none. */
  widthAlternateKey?: number;
  /** The mark this row carries in that room, last, as the ERD scene draws it. */
  alternateKey?: string;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  const getColumnOrder = (): ColumnOrderTpl[] => {
    const { store } = app.value;
    const { t } = i18n.value;
    const { settings } = store.state;
    const { column, widthName, widthDataType, widthDefault, widthComment } =
      props;

    return settings.columnOrder
      .map((columnType: number) => {
        let template: DOMTemplateLiterals | null = null;

        switch (columnType) {
          case ColumnType.columnName: {
            const { value, placeholder } = nameCellText(
              settings,
              column,
              i18n.value
            );
            template = (
              <div class="column-col">
                <EditInput
                  placeholder={placeholder}
                  width={widthName}
                  value={value}
                />
              </div>
            );
            break;
          }
          case ColumnType.columnLogicalName: {
            if (!isBothNameView(settings)) break;
            const { value, placeholder } = logicalNameCellText(
              settings,
              column,
              'common.placeholder.column',
              i18n.value
            );
            template = (
              <div class="column-col">
                <EditInput
                  placeholder={placeholder}
                  width={props.widthLogicalName ?? 0}
                  value={value}
                />
              </div>
            );
            break;
          }
          case ColumnType.columnDomain:
            template = bHas(settings.show, Show.columnDomain) ? (
              <div class="column-col">
                <EditInput
                  placeholder={t('common.placeholder.domain')}
                  width={props.widthDomain ?? 0}
                  value={domainCellText(store.state, column)}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault) ? (
              <div class="column-col">
                <EditInput
                  placeholder={t('common.placeholder.default')}
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
                  placeholder={t('common.placeholder.comment')}
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
                  value={typeCellText(store.state, column)}
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
                  title={t('common.column.unique')}
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
                  title={t('common.column.autoIncrement')}
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
        {props.widthAlternateKey ? (
          <div
            class="column-col"
            style={{
              width: `${props.widthAlternateKey}px`,
              'min-width': `${props.widthAlternateKey}px`,
              'box-sizing': 'content-box',
              color: 'var(--foreground)',
              'font-family': 'var(--code-font-family)',
              'white-space': 'nowrap',
            }}
            data-alternate-key
          >
            {props.alternateKey ?? ''}
          </div>
        ) : null}
      </div>
    );
  };
};

export default Column;
