import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import type { Table } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

export type TableProps = {
  table: Table;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const { table } = props;
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
      ></div>
    `;
  };
};

export default Table;
