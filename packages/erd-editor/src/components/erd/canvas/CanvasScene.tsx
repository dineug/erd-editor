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
import { createRetentionPool } from '@/components/erd/canvas/sceneRetention';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import Table from '@/components/erd/canvas/table/Table';
import ParticleLayer from '@/components/focus-view/particles/ParticleLayer';
import { useSceneSource } from '@/components/sceneSourceContext';
import { Show } from '@/constants/schema';
import type { Relationship } from '@/internal-types';
import { renderKonva } from '@/konva/host';
import { getFadedIds, getVisibleIds } from '@/konva/scene/viewLayout';
import {
  getCullingRect,
  getSceneOrigin,
  getSceneTransform,
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
 * The layers of the canvas, four over the document and four under a view,
 * plus the one a drag opens. Each carries the canvas transform but the
 * marquee, which stays in screen space where its own mousemove measures.
 */
const CanvasScene: FC<CanvasSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const sourceRef = useSceneSource(ctx);
  const retention = createRetentionPool();

  return () => {
    const { store } = app.value;
    const { state } = store;
    const {
      editor: { drawRelationship },
      collections,
    } = state;
    const source = sourceRef.value;
    const transform = getSceneTransform(state, source);
    const { zoomLevel } = transform;

    // The show bits are the document scene's own setting. A view spells what
    // it shows for itself, and its links are the point of it, so a reader who
    // hid connectors in the ERD still gets them here.
    const showRelationship =
      source !== 'document' || bHas(state.settings.show, Show.relationship);

    // What this source shows: the whole document, or what the active view
    // places, keeps within its hop and joins, memos left out of it.
    const { tableIds, memoIds, relationshipIds } = getVisibleIds(state, source);

    const cullingRect = getCullingRect(state, source);

    // Read only while a drag runs, or the scene would re-render on a selection
    // that moves nothing. What moves is what moveAllAction$ moves.
    const dragIds = isEntityDragActive(state, source)
      ? new Set(Object.keys(state.editor.selectedMap))
      : null;
    const dragging = Boolean(dragIds?.size);

    const tableEntities = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const drawnIds = new Set(
      tableEntities
        .filter(table => isTableVisible(cullingRect, state, table, source))
        .map(table => table.id)
    );

    // A table that scrolled off stays built but hidden for a while, so a scroll
    // back finds it rather than rebuilding it; the pool bounds how many.
    const retainedIds = retention.retain(drawnIds, new Set(tableIds));

    const allTables = tableEntities
      .filter(table => drawnIds.has(table.id) || retainedIds.has(table.id))
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

    // What a Flow hover fades, decided here and handed down as a flag: only
    // the tables and connectors whose flag flips redraw, where a leaf reading
    // the hover itself would walk every link on every hover, once per table.
    const faded = getFadedIds(state, source);
    const isFadedTable = (id: string) => faded?.tableIds.has(id) ?? false;

    /**
     * A view draws its own spelling at every zoom: its rows are already the
     * few its show mode keeps, and the shrunk box a low zoom asks the document
     * for would take that away and put the document's rows back on a zoom in.
     */
    const highLevel = source === 'document' && isHighLevelTable(zoomLevel);

    // A peer broadcasts document points and the ghost an alt drag carries
    // reads the document zoom, so the presence layer is the document scene's
    // alone; a view would stand the same cursors somewhere unrelated.
    const presence = source === 'document';

    /** The tables of one layer, in whichever spelling the zoom asks for. */
    const tableShapes = (list: typeof allTables) =>
      cache(
        highLevel ? (
          <>
            {repeat(
              list,
              table => table.id,
              table => (
                <HighLevelTable
                  table={table}
                  visible={drawnIds.has(table.id)}
                />
              )
            )}
          </>
        ) : (
          <>
            {repeat(
              list,
              table => table.id,
              table => (
                <Table
                  table={table}
                  visible={drawnIds.has(table.id)}
                  faded={isFadedTable(table.id)}
                />
              )
            )}
          </>
        )
      );

    // The one place the scene transform is written down, so the rect above
    // culls against the origin these layers are actually placed at.
    const { x, y } = getSceneOrigin(transform);

    // The bottom layer paints nothing of its own now that the document has no
    // edge; it exists for a drag's own connectors, which go under the static
    // scene. A layer each would put the stage at six, where konva warns.
    return (
      <>
        <k-layer
          name="canvas-background"
          x={x}
          y={y}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          {dragging && showRelationship ? (
            <RelationshipGroup
              relationships={dragRelationships}
              viewport={cullingRect}
              fadedIds={faded?.relationshipIds}
            />
          ) : null}
        </k-layer>
        <k-layer name="scene" x={x} y={y} scaleX={zoomLevel} scaleY={zoomLevel}>
          {showRelationship ? (
            <RelationshipGroup
              relationships={relationships}
              viewport={cullingRect}
              fadedIds={faded?.relationshipIds}
            />
          ) : null}
          {source === 'document' && drawRelationship?.start ? (
            <DrawRelationship root={props.root} draw={drawRelationship} />
          ) : null}
          {tableShapes(tables)}
          {repeat(
            memos,
            memo => memo.id,
            memo => (
              <Memo memo={memo} />
            )
          )}
        </k-layer>
        {source !== 'document' ? <ParticleLayer /> : null}
        {dragging ? (
          <k-layer
            name="drag-entity"
            x={x}
            y={y}
            scaleX={zoomLevel}
            scaleY={zoomLevel}
          >
            {tableShapes(dragTables)}
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
        {presence ? (
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
        ) : null}
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
