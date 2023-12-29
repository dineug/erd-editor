import { query } from '@dineug/erd-editor-schema';
import { cache, FC, html, Ref, ref, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import CanvasSvg from '@/components/erd/canvas/canvas-svg/CanvasSvg';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import Memo from '@/components/erd/canvas/memo/Memo';
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
          'pointer-events': props.grabMove ? 'none' : 'auto',
        }}
      >
        ${cache(
          isHighLevelTable(zoomLevel)
            ? html`${repeat(
                tables,
                table => table.id,
                table => html`<${HighLevelTable} table=${table} />`
              )}`
            : html`${repeat(
                tables,
                table => table.id,
                table => html`<${Table} table=${table} />`
              )}`
        )}
        ${repeat(
          memos,
          memo => memo.id,
          memo => html`<${Memo} memo=${memo} />`
        )}
        ${bHas(show, Show.relationship) ? html`<${CanvasSvg} />` : null}
        ${drawRelationship?.start
          ? html`
              <${DrawRelationship}
                root=${props.root}
                draw=${drawRelationship}
              />
            `
          : null}
        <${SharedMouseTracker} />
      </div>
    `;
  };
};

export default Canvas;
