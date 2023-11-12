import { cache, FC, html, Ref, ref, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import Memo from '@/components/erd/canvas/memo/Memo';
import Table from '@/components/erd/canvas/table/Table';
import { query } from '@/utils/collection/query';

import * as styles from './Canvas.styles';

export type CanvasProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
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

    return html`
      <div
        class=${styles.root}
        ${ref(props.canvas)}
        style=${{
          width: `${width}px`,
          height: `${height}px`,
          'min-width': `${width}px`,
          'min-height': `${height}px`,
          transform: `translate(${scrollLeft}px, ${scrollTop}px) scale(${zoomLevel})`,
        }}
      >
        ${cache(
          zoomLevel > 0.7
            ? html`${repeat(
                tables,
                table => table.id,
                table => html`<${Table} table=${table} />`
              )}`
            : html`${repeat(
                tables,
                table => table.id,
                table => html`<${HighLevelTable} table=${table} />`
              )}`
        )}
        ${repeat(
          memos,
          memo => memo.id,
          memo => html`<${Memo} memo=${memo} />`
        )}
        ${drawRelationship?.start
          ? html`<${DrawRelationship}
              root=${props.root}
              draw=${drawRelationship}
            />`
          : null}
      </div>
    `;
  };
};

export default Canvas;
