import { FC, html } from '@dineug/r-html';
import { debounce } from 'lodash-es';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import type { Table } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { updateObjectGridMapAction } from '@/utils/emitter';

export type TableProps = {
  table: Table;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const updateObjectGridMap = debounce(
    (payload: ReturnType<typeof updateObjectGridMapAction>['payload']) => {
      const { emitter } = app.value;
      emitter.emit(updateObjectGridMapAction(payload));
    },
    200
  );

  return () => {
    const { store } = app.value;
    const { table } = props;
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

    updateObjectGridMap({
      id: table.id,
      x: table.ui.x,
      y: table.ui.y,
      width: tableWidths.width,
      height,
    });

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
