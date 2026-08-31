/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import Memo from '@/components/erd/minimap/memo/Memo';
import Table from '@/components/erd/minimap/table/Table';
import { MINIMAP_SIZE } from '@/constants/layout';
import { Show } from '@/constants/schema';
import { renderKonva } from '@/konva/host';
import { bHas } from '@/utils/bit';

/**
 * Not a multiple of what the canvas draws: the minimap scales the whole canvas
 * down far enough that a connector at the canvas width lands under a device
 * pixel. This floor is independent.
 */
const STROKE_WIDTH = 12;

export type MinimapSceneProps = {};

type Stacked = { ui: { zIndex: number } };

const byZIndex = (a: Stacked, b: Stacked) => a.ui.zIndex - b.ui.zIndex;

/**
 * The whole document on one layer, with no culling: a thumbnail that dropped
 * what is off screen would stop being a map of where the rest of it is.
 */
const MinimapScene: FC<MinimapSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      settings: { width, height, zoomLevel, show },
      doc: { tableIds, memoIds, relationshipIds },
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

    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    // Two css scales in one layer transform: the thumbnail ratio the container
    // used to carry, and the canvas zoom the copy inside it did. Both scaled
    // about the middle of the canvas box, which is what the offsets restate.
    const ratio = MINIMAP_SIZE / width;
    const scale = ratio * zoomLevel;
    const x = (ratio * width * (1 - zoomLevel)) / 2;
    const y = (ratio * height * (1 - zoomLevel)) / 2;

    return (
      <k-layer
        name="minimap-scene"
        listening={false}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
      >
        {bHas(show, Show.relationship) ? (
          <RelationshipGroup
            relationships={relationships}
            strokeWidth={STROKE_WIDTH}
          />
        ) : null}
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
