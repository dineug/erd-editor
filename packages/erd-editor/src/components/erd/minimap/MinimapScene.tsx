/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import Memo from '@/components/erd/minimap/memo/Memo';
import { getMinimapRatio } from '@/components/erd/minimap/minimapGeometry';
import Table from '@/components/erd/minimap/table/Table';
import { renderKonva } from '@/konva/host';

export type MinimapSceneProps = {};

type Stacked = { ui: { zIndex: number } };

const byZIndex = (a: Stacked, b: Stacked) => a.ui.zIndex - b.ui.zIndex;

/**
 * The whole document on one layer, with no culling: a thumbnail that dropped
 * what is off screen would stop being a map of where the rest of it is. Boxes
 * only, because a connector between two of them is noise at this size.
 */
const MinimapScene: FC<MinimapSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      settings: { width },
      doc: { tableIds, memoIds },
      collections,
    } = store.state;

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds)
      .sort(byZIndex);

    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .sort(byZIndex);

    // One scale and no offset: the canvas box fills the minimap square whatever
    // the zoom is, and the zoom is drawn by the viewport rectangle over it.
    const scale = getMinimapRatio(width);

    return (
      <k-layer
        name="minimap-scene"
        listening={false}
        scaleX={scale}
        scaleY={scale}
      >
        {repeat(
          tables,
          table => table.id,
          table => (
            <Table table={table} />
          )
        )}
        {repeat(
          memos,
          memo => memo.id,
          memo => (
            <Memo memo={memo} />
          )
        )}
      </k-layer>
    );
  };
};

/**
 * Renders the minimap scene as the root of its Stage. Named in lower case on
 * purpose: an all-upper-case export list makes r-html's refresh treat this as a
 * component module and self-accept it, which kills hmr for the whole scene.
 */
export function renderMinimapScene(stage: Stage): void {
  renderKonva(stage, <MinimapScene />);
}

export default MinimapScene;
