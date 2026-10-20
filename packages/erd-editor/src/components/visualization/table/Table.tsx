import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import { logicalNameCellText } from '@/components/table-view/column/columnViewText';
import * as styles from '@/components/table-view/Table.styles';
import Column from '@/components/visualization/table/column/Column';
import { TABLE_HEADER_ICON_SIZE } from '@/constants/layout';
import { FocusType } from '@/engine/modules/editor/state';
import { getTableFocusTypes } from '@/engine/modules/editor/utils/nameView';
import type { Table } from '@/internal-types';
import {
  calcTableHeight,
  calcTableWidths,
  headerCellWidth,
} from '@/utils/calcTable';
import { getAlternateKeyMarks } from '@/utils/tableKeys';

export type TableProps = {
  table: Table;
  x: number;
  y: number;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  /** One header cell, the ones the name view lays out, as the canvas header draws them. */
  const headerCell = (focusType: FocusType) => {
    const { store } = app.value;
    const { t } = i18n.value;
    const { table } = props;

    switch (focusType) {
      case FocusType.tableLogicalName: {
        const { value, placeholder } = logicalNameCellText(
          store.state.settings,
          table,
          'common.placeholder.table',
          i18n.value
        );
        return (
          <div class="input-padding">
            <EditInput
              placeholder={placeholder}
              width={headerCellWidth(store.state, table, focusType)}
              value={value}
            />
          </div>
        );
      }
      case FocusType.tableComment:
        return (
          <div class="input-padding">
            <EditInput
              placeholder={t('common.placeholder.comment')}
              width={table.ui.widthComment}
              value={table.comment}
            />
          </div>
        );
      default:
        return (
          <div class="input-padding">
            <EditInput
              placeholder={t('common.placeholder.table')}
              width={table.ui.widthName}
              value={table.name}
            />
          </div>
        );
    }
  };

  return () => {
    const { store } = app.value;
    const { settings, collections } = store.state;
    const { table, x, y } = props;
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);
    const alternateKeyMarks = tableWidths.alternateKey
      ? getAlternateKeyMarks(store.state, table)
      : {};

    return (
      <div
        class={['table', styles.root]}
        style={{
          top: `${y}px`,
          left: `${x}px`,
          width: `${tableWidths.width}px`,
          height: `${height}px`,
          position: 'fixed',
        }}
        data-id={table.id}
      >
        <div
          class={['table-header-color', styles.headerColor]}
          style={{
            'background-color': table.ui.color,
          }}
        ></div>
        <div class={styles.header}>
          <Icon name="table-2" size={TABLE_HEADER_ICON_SIZE} />
          <div class={styles.headerInputWrap}>
            {getTableFocusTypes(settings).map(headerCell)}
          </div>
        </div>
        {columns.length ? (
          <div>
            {repeat(
              columns,
              column => column.id,
              column => (
                <Column
                  column={column}
                  widthName={tableWidths.name}
                  widthDataType={tableWidths.dataType}
                  widthDefault={tableWidths.default}
                  widthComment={tableWidths.comment}
                  widthLogicalName={tableWidths.logicalName}
                  widthDomain={tableWidths.domain}
                  widthAlternateKey={tableWidths.alternateKey}
                  alternateKey={alternateKeyMarks[column.id]}
                />
              )
            )}
          </div>
        ) : null}
      </div>
    );
  };
};

export default Table;
