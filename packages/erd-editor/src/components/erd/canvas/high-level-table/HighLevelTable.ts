import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import { useMoveTable } from '@/components/erd/canvas/table/useMoveTable';
import { Table } from '@/internal-types';
import {
  fontSize5,
  fontSize6,
  fontSize7,
  fontSize8,
  fontSize9,
} from '@/styles/typography.styles';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

import * as highLevelTableStyle from './HighLevelTable.styles';

export type HighLevelTableProps = {
  table: Table;
};

const HighLevelTable: FC<HighLevelTableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { onMoveStart } = useMoveTable(ctx, props);

  const fontSize = () => {
    const { store } = app.value;
    const {
      settings: { zoomLevel },
    } = store.state;
    let fontSize = fontSize5.toString();

    if (zoomLevel > 0.6) {
      fontSize = fontSize5.toString();
    } else if (zoomLevel > 0.5) {
      fontSize = fontSize6.toString();
    } else if (zoomLevel > 0.4) {
      fontSize = fontSize7.toString();
    } else if (zoomLevel > 0.3) {
      fontSize = fontSize8.toString();
    } else {
      fontSize = fontSize9.toString();
    }

    return fontSize;
  };

  return () => {
    const { store } = app.value;
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
        ?data-selected=${selected}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class=${styles.header}>
          <div
            class=${['table-header-color', styles.headerColor]}
            style=${{
              'background-color': table.ui.color,
            }}
          ></div>
        </div>
        <div class=${['scrollbar', highLevelTableStyle.name, fontSize()]}>
          ${table.name}
        </div>
      </div>
    `;
  };
};

export default HighLevelTable;
