import { query } from '@dineug/erd-editor-schema';
import { cache, FC, Ref, ref, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import CanvasSvg from '@/components/erd/canvas/canvas-svg/CanvasSvg';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import DuplicateGhost from '@/components/erd/canvas/duplicate-ghost/DuplicateGhost';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import Memo from '@/components/erd/canvas/memo/Memo';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import Table from '@/components/erd/canvas/table/Table';
import { Show } from '@/constants/schema';
import { bHas } from '@/utils/bit';
import { isHighLevelTable } from '@/utils/validation';

import * as styles from './Canvas.styles';

export type CanvasProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
  grabMove?: boolean;
};

const Canvas: FC<CanvasProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      settings: { width, height, scrollTop, scrollLeft, zoomLevel, show },
      doc: { tableIds, memoIds },
      editor: { drawRelationship },
      collections,
    } = store.state;

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);

    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    return (
      <div
        class={styles.controller}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          'min-width': `${width}px`,
          'min-height': `${height}px`,
          transform: `translate(${scrollLeft}px, ${scrollTop}px) scale(${zoomLevel})`,
          'pointer-events': props.grabMove ? 'none' : 'auto',
        }}
      >
        <div
          class={styles.root}
          data-testid="erd-canvas"
          use:ref={ref(props.canvas)}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            'min-width': `${width}px`,
            'min-height': `${height}px`,
          }}
        >
          {cache(
            isHighLevelTable(zoomLevel) ? (
              <>
                {repeat(
                  tables,
                  table => table.id,
                  table => (
                    <HighLevelTable table={table} />
                  )
                )}
              </>
            ) : (
              <>
                {repeat(
                  tables,
                  table => table.id,
                  table => (
                    <Table table={table} />
                  )
                )}
              </>
            )
          )}
          {repeat(
            memos,
            memo => memo.id,
            memo => (
              <Memo memo={memo} />
            )
          )}
          {bHas(show, Show.relationship) ? <CanvasSvg /> : null}
          {drawRelationship?.start ? (
            <DrawRelationship root={props.root} draw={drawRelationship} />
          ) : null}
          <SharedMouseTracker />
          <SharedDragSelect />
          <DuplicateGhost />
        </div>
      </div>
    );
  };
};

export default Canvas;
