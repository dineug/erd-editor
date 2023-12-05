import { FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import Icon from '@/components/primitives/icon/Icon';
import { OrderType } from '@/constants/schema';
import { Index, IndexColumn } from '@/internal-types';
import { query } from '@/utils/collection/query';
import { onPrevent } from '@/utils/domEvent';

import * as styles from './IndexesColumn.styles';

export type IndexesColumnProps = {
  index: Index;
};

const IndexesColumn: FC<IndexesColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const toOrderName = (orderType: number) => {
    switch (orderType) {
      case OrderType.ASC:
        return 'ASC';
      case OrderType.DESC:
        return 'DESC';
      default:
        return '';
    }
  };

  const toOrderTitle = (orderType: number) => {
    switch (orderType) {
      case OrderType.ASC:
        return 'Ascending';
      case OrderType.DESC:
        return 'Descending';
      default:
        return '';
    }
  };

  const handleDragstart = (event: DragEvent) => {
    // TODO: change order indexColumn
    console.log('handleDragstart', event);
  };

  const handleChangeOrderType = (indexColumn: IndexColumn) => {
    // TODO: change indexColumn orderType
    console.log('handleChangeOrderType', indexColumn);
  };

  return () => {
    const { store } = app.value;
    const { collections } = store.state;

    const indexColumns = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(props.index.indexColumnIds)
      .map(indexColumn => ({
        ...indexColumn,
        column: query(collections)
          .collection('tableColumnEntities')
          .selectById(indexColumn.columnId),
      }));

    return html`
      <div class=${styles.root} @dragenter=${onPrevent} @dragover=${onPrevent}>
        ${repeat(
          indexColumns,
          indexColumn => indexColumn.id,
          indexColumn => html`
            <div
              class=${styles.row}
              draggable="true"
              data-id=${indexColumn.id}
              @dragstart=${handleDragstart}
            >
              <${Icon} class=${'column-col'} name="bars" size=${14} />
              <div
                class="column-col"
                @click=${() => handleChangeOrderType(indexColumn)}
              >
                <${ColumnOption}
                  class=${styles.orderType}
                  checked=${true}
                  width=${40}
                  text=${toOrderName(indexColumn.orderType)}
                  title=${toOrderTitle(indexColumn.orderType)}
                />
              </div>
              <div class="column-col">${indexColumn.column?.name}</div>
            </div>
          `
        )}
      </div>
    `;
  };
};

export default IndexesColumn;
