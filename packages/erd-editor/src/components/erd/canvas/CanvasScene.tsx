/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { cache, FC, Ref, repeat } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import DragSelect from '@/components/erd/canvas/drag-select/DragSelect';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import DuplicateGhost from '@/components/erd/canvas/duplicate-ghost/DuplicateGhost';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import Memo from '@/components/erd/canvas/memo/Memo';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import Table from '@/components/erd/canvas/table/Table';
import { useThemeContext } from '@/components/themeContext';
import { Show } from '@/constants/schema';
import type { Relationship } from '@/internal-types';
import { renderKonva } from '@/konva/host';
import {
  getCullingRect,
  getSceneOrigin,
  isMemoVisible,
  isTableVisible,
} from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import { isHighLevelTable } from '@/utils/validation';

export type CanvasSceneProps = {
  root: Ref<HTMLDivElement>;
};

type Stacked = { ui: { zIndex: number } };

/**
 * The order the DOM scene spelled as a z-index. Konva paints siblings in order,
 * so whatever was raised last has to end up the last child of its layer.
 */
const byZIndex = (a: Stacked, b: Stacked) => a.ui.zIndex - b.ui.zIndex;

/**
 * The four layers of the canvas, plus the one a drag opens. Background, scene
 * and presence carry the canvas transform, and the marquee layer stays in
 * screen space because that is where its own mousemove measures.
 */
const CanvasScene: FC<CanvasSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { store } = app.value;
    const { state } = store;
    const {
      settings: { width, height, zoomLevel, show },
      doc: { tableIds, memoIds, relationshipIds },
      editor: { drawRelationship },
      collections,
    } = state;
    const theme = themeRef.value;

    const cullingRect = getCullingRect(state);

    // Read only while a drag runs, or the scene would re-render on a selection
    // that moves nothing. What moves is what moveAllAction$ moves.
    const dragIds = isEntityDragActive()
      ? new Set(Object.keys(state.editor.selectedMap))
      : null;
    const dragging = Boolean(dragIds?.size);

    const allTables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds)
      .filter(table => isTableVisible(cullingRect, state, table))
      .sort(byZIndex);

    const allMemos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .filter(memo => isMemoVisible(cullingRect, memo))
      .sort(byZIndex);

    const allRelationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    const isMoving = ({ start, end }: Relationship) =>
      Boolean(dragIds?.has(start.tableId) || dragIds?.has(end.tableId));

    const tables = dragging
      ? allTables.filter(table => !dragIds?.has(table.id))
      : allTables;
    const memos = dragging
      ? allMemos.filter(memo => !dragIds?.has(memo.id))
      : allMemos;
    const relationships = dragging
      ? allRelationships.filter(relationship => !isMoving(relationship))
      : allRelationships;

    /**
     * What the drag moves, split off so a move redraws these two small layers
     * instead of the one every static table sits in. Connectors go under the
     * scene and entities over it, the order they already had inside it.
     */
    const dragTables = dragging
      ? allTables.filter(table => dragIds?.has(table.id))
      : [];
    const dragMemos = dragging
      ? allMemos.filter(memo => dragIds?.has(memo.id))
      : [];
    const dragRelationships = dragging ? allRelationships.filter(isMoving) : [];

    // The one place the scene transform is written down, so the rect above
    // culls against the origin these layers are actually placed at.
    const { x, y } = getSceneOrigin(state.settings);

    /**
     * The document box, nameless and deaf on purpose: a named node is projected
     * into an element by the e2e scene mirror, and a listening one would answer
     * the hit test that bare canvas has to leave unanswered.
     */
    const documentBox = (
      <k-rect
        listening={false}
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme.canvasBackground}
      />
    );

    // Everything under the static scene shares the bottom layer: the document
    // box always, and a drag's own connectors while one runs. A layer each
    // would put the stage at six while dragging, which is where konva warns.
    return (
      <>
        <k-layer
          name="canvas-background"
          x={x}
          y={y}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          {documentBox}
          {dragging && bHas(show, Show.relationship) ? (
            <RelationshipGroup
              relationships={dragRelationships}
              viewport={cullingRect}
            />
          ) : null}
        </k-layer>
        <k-layer name="scene" x={x} y={y} scaleX={zoomLevel} scaleY={zoomLevel}>
          {bHas(show, Show.relationship) ? (
            <RelationshipGroup
              relationships={relationships}
              viewport={cullingRect}
            />
          ) : null}
          {drawRelationship?.start ? (
            <DrawRelationship root={props.root} draw={drawRelationship} />
          ) : null}
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
        </k-layer>
        {dragging ? (
          <k-layer
            name="drag-entity"
            x={x}
            y={y}
            scaleX={zoomLevel}
            scaleY={zoomLevel}
          >
            {cache(
              isHighLevelTable(zoomLevel) ? (
                <>
                  {repeat(
                    dragTables,
                    table => table.id,
                    table => (
                      <HighLevelTable table={table} />
                    )
                  )}
                </>
              ) : (
                <>
                  {repeat(
                    dragTables,
                    table => table.id,
                    table => (
                      <Table table={table} />
                    )
                  )}
                </>
              )
            )}
            {repeat(
              dragMemos,
              memo => memo.id,
              memo => (
                <Memo memo={memo} />
              )
            )}
          </k-layer>
        ) : null}
        <k-layer name="overlay-marquee" listening={false}>
          <DragSelect root={props.root} />
        </k-layer>
        <k-layer
          name="presence"
          listening={false}
          x={x}
          y={y}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          <SharedMouseTracker />
          <SharedDragSelect />
          <DuplicateGhost />
        </k-layer>
      </>
    );
  };
};

/**
 * Renders the scene as the root of a Stage. Named in lower case on purpose:
 * r-html's refresh boundary treats an all-upper-case export list as a component
 * module and would self-accept this one, which kills hmr for the whole scene.
 */
export function renderCanvasScene(stage: Stage, props: CanvasSceneProps): void {
  renderKonva(stage, <CanvasScene root={props.root} />);
}

export default CanvasScene;
