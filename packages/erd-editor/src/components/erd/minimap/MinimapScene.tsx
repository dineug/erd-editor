/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import Memo from '@/components/erd/minimap/memo/Memo';
import {
  getMinimapLayout,
  toMinimapPoint,
} from '@/components/erd/minimap/minimapGeometry';
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

    // The map's ratio as the one scale and its corner as the one offset: scene
    // zero lands where the map puts it, and the centring in the minimap square
    // is the container's to do, so nothing here restates it.
    const layout = getMinimapLayout(store.state);
    const place = toMinimapPoint(layout, { x: 0, y: 0 });

    return (
      <k-layer
        name="minimap-scene"
        listening={false}
        scaleX={layout.ratio}
        scaleY={layout.ratio}
        x={place.x}
        y={place.y}
      >
        {repeat(
          tables,
          table => table.id,
          table => (
            <Table table={table} ratio={layout.ratio} />
          )
        )}
        {repeat(
          memos,
          memo => memo.id,
          memo => (
            <Memo memo={memo} ratio={layout.ratio} />
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
