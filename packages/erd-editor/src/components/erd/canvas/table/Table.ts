import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { Table } from '@/internal-types';
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
          zIndex: `${table.ui.zIndex}`,
          width: `${tableWidths.width}px`,
          height: `${height}px`,
        }}
        ?selected=${selected}
        @mousedown=${handleMoveStart}
        @touchstart=${handleMoveStart}
      >
        table
      </div>
    `;
  };
};

export default Table;
