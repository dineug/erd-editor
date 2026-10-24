/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { cache, FC, Ref, repeat } from '@dineug/r-html';
import { renderKonva } from '@dineug/r-html-konva';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import { stopTransitions } from '@/components/erd/canvas/highlightTransition';
import Memo from '@/components/erd/canvas/memo/Memo';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import { createRetentionPool } from '@/components/erd/canvas/sceneRetention';
import Table from '@/components/erd/canvas/table/Table';
import TableGroups from '@/components/erd/canvas/table-group/TableGroups';
import { useSceneSource } from '@/components/sceneSourceContext';
import { Show } from '@/constants/schema';
import type { DrawRelationship } from '@/engine/modules/editor/state';
import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Relationship, Table as TableEntity } from '@/internal-types';
import {
  type StackedEntity,
  stackedKey,
  stackTablesAndMemos,
} from '@/konva/scene/stacking';
import {
  getHighlightIds,
  getVisibleIds,
  relationshipColumnIdsByTable,
} from '@/konva/scene/viewLayout';
import {
  getCullingRect,
  getSceneOrigin,
  getSceneTransform,
  isMemoVisible,
  isTableVisible,
} from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import { getTableGroupMemberIds, isTableGroupShown } from '@/utils/tableGroup';
import { isHighLevelTable } from '@/utils/validation';

/**
 * What a host adds at the layers of its scene, beside what every scene draws.
 * The ERD tab hands in its editing and presence parts, the Flow its particles
 * and marquee, and a scene that edits nothing hands in none.
 */
export type CanvasLayers = {
  /** A layer of its own between the bottom layer and the scene: the Flow's particles. */
  beneath?: FC;
  /** In the scene layer over the connectors, a relationship draw's preview once it has a start. */
  relationshipDraw?: FC<{ root: Ref<HTMLDivElement>; draw: DrawRelationship }>;
  /** In the drag layer under what a drag carries, where it would drop tables into groups. */
  dropTarget?: FC;
  /** A layer of its own in screen space, measured against the root: the marquee. */
  marquee?: FC<{ root: Ref<HTMLDivElement> }>;
  /** A layer of its own at document points, on top: collaborators and the ghosts drags carry. */
  presence?: FC[];
};

export type CanvasSceneProps = {
  root: Ref<HTMLDivElement>;
  /** Read once, as the stage mounts the scene. */
  layers?: CanvasLayers;
};

/**
 * The layers of the canvas: the bottom one, the scene and the one a drag
 * opens, with those the host's layers add. Each carries the canvas transform
 * but the marquee's, which stays in screen space where its mousemove measures.
 */
const CanvasScene: FC<CanvasSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const sourceRef = useSceneSource(ctx);
  const retention = createRetentionPool();
  const { addUnsubscribe } = useUnmounted();
  const {
    beneath: Beneath,
    relationshipDraw: RelationshipDraw,
    dropTarget: DropTarget,
    marquee: Marquee,
    presence: presenceParts = [],
  } = props.layers ?? {};

  // The highlight the cards and connectors of a view were walking through
  // belongs to the scene that opened it, and the ticker keys each one by
  // editor, so a closing view drops its own and leaves the document's alone.
  addUnsubscribe(() => {
    if (sourceRef.value === 'document') return;

    stopTransitions(app.value.store.state.editor.id);
  });

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
    // places, keeps within its hop and joins, memos and groups left out of it.
    const { tableIds, memoIds, relationshipIds, tableGroupIds } = getVisibleIds(
      state,
      source
    );

    const cullingRect = getCullingRect(state, source);

    // Read only while a drag runs, or the scene would re-render on a selection
    // that moves nothing. What moves is what moveAllAction$ moves: the
    // selection, and in the document the members of a selected group too.
    const dragIds = isEntityDragActive(state, source)
      ? new Set([
          ...Object.keys(state.editor.selectedMap),
          ...(source === 'document'
            ? getSelectTypeIds(state.editor.selectedMap).tableGroupIds.flatMap(
                id => getTableGroupMemberIds(state, id)
              )
            : []),
        ])
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

    const allTables = tableEntities.filter(
      table => drawnIds.has(table.id) || retainedIds.has(table.id)
    );

    const allMemos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .filter(memo => isMemoVisible(cullingRect, memo));

    const allRelationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    // Behind everything else, a few large boxes, so none is culled; the layer
    // they stand in draws and orders them itself (TableGroups).
    const groupShown =
      Boolean(tableGroupIds.length) && isTableGroupShown(state);

    // The group each table's header takes its color from, named off one read
    // of the list, so a group coming or going re-renders no other table.
    const liveGroupIds =
      groupShown && source === 'document' ? new Set(tableGroupIds) : null;
    const groupIdOf = (table: TableEntity) =>
      liveGroupIds?.has(table.groupId) ? table.groupId : '';

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

    // A drag of a group takes every group under the static scene, by zIndex
    // as they stood, so a step redraws the bottom layer and never the one the
    // tables sit in, and the group raised by its press stays over the others.
    const groupDrag =
      groupShown && dragging && tableGroupIds.some(id => dragIds?.has(id));

    // The groups a table drag would drop into, outlined over the static scene.
    const dropTarget =
      dragging && groupShown && source === 'document' && !store.getReadonly();

    // What a view lights, decided here and handed down as a flag: only the
    // cards and connectors whose flag flips redraw, where a leaf reading the
    // highlight itself would walk every link on every hover, once per leaf.
    const lit = source === 'document' ? null : getHighlightIds(state, source);
    const isLitTable = (id: string) => lit?.tableIds.has(id) ?? false;

    // The rows a view tints, walked once here for the same reason the light is:
    // a card reading its own would walk every relationship of the document, and
    // every card with rows would then be an observer of the whole link list.
    const related =
      source === 'document' ? null : relationshipColumnIdsByTable(state);

    /**
     * A view draws its own spelling at every zoom: its rows are already the
     * few its show mode keeps, and the shrunk box a low zoom asks the document
     * for would take that away and put the document's rows back on a zoom in.
     */
    const highLevel = source === 'document' && isHighLevelTable(zoomLevel);

    // A peer broadcasts document points, and the ghosts an alt drag and a
    // column drag carry are document drags, so the presence layer is the
    // document scene's alone; a view would stand them somewhere unrelated.
    const presence = source === 'document' && presenceParts.length > 0;

    /** A table in whichever spelling the zoom asks for, both kept so a zoom across the threshold rebuilds neither. */
    const tableShape = (table: TableEntity) =>
      cache(
        highLevel ? (
          <HighLevelTable table={table} visible={drawnIds.has(table.id)} />
        ) : (
          <Table
            table={table}
            visible={drawnIds.has(table.id)}
            lit={isLitTable(table.id)}
            relatedColumnIds={related?.get(table.id) ?? null}
            tableGroupId={groupIdOf(table)}
          />
        )
      );

    // Konva paints siblings in order, so tables and memos go in as one stack,
    // whatever was raised last the last child of its layer. A memo stays out
    // of the cache, so a zoom across the threshold never takes it away.
    /** The tables and memos of one layer in their one stack. */
    const entityShapes = (list: StackedEntity[]) =>
      repeat(list, stackedKey, item =>
        item.kind === 'table' ? (
          <>{tableShape(item.entity)}</>
        ) : (
          <Memo memo={item.entity} />
        )
      );

    // The one place the scene transform is written down, so the rect above
    // culls against the origin these layers are actually placed at.
    const { x, y } = getSceneOrigin(transform);

    // The bottom layer paints nothing of its own now that the document has no
    // edge; it holds a group drag's groups and a drag's connectors, under the
    // static scene. A layer each would put the stage at six, where konva warns.
    return (
      <>
        <k-layer
          name="canvas-background"
          x={x}
          y={y}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          {groupDrag ? <TableGroups /> : null}
          {dragging && showRelationship ? (
            <RelationshipGroup
              relationships={dragRelationships}
              viewport={cullingRect}
              litIds={lit?.relationshipIds}
            />
          ) : null}
        </k-layer>
        {Beneath ? <Beneath /> : null}
        <k-layer name="scene" x={x} y={y} scaleX={zoomLevel} scaleY={zoomLevel}>
          {groupShown && !groupDrag ? <TableGroups /> : null}
          {showRelationship ? (
            <RelationshipGroup
              relationships={relationships}
              viewport={cullingRect}
              litIds={lit?.relationshipIds}
            />
          ) : null}
          {RelationshipDraw &&
          source === 'document' &&
          drawRelationship?.start ? (
            <RelationshipDraw root={props.root} draw={drawRelationship} />
          ) : null}
          {entityShapes(stackTablesAndMemos(tables, memos))}
        </k-layer>
        {dragging ? (
          <k-layer
            name="drag-entity"
            x={x}
            y={y}
            scaleX={zoomLevel}
            scaleY={zoomLevel}
          >
            {DropTarget && dropTarget ? <DropTarget /> : null}
            {entityShapes(stackTablesAndMemos(dragTables, dragMemos))}
          </k-layer>
        ) : null}
        {Marquee ? (
          <k-layer name="overlay-marquee" listening={false}>
            <Marquee root={props.root} />
          </k-layer>
        ) : null}
        {presence ? (
          <k-layer
            name="presence"
            listening={false}
            x={x}
            y={y}
            scaleX={zoomLevel}
            scaleY={zoomLevel}
          >
            {repeat(
              presenceParts,
              part => part,
              Part => (
                <Part />
              )
            )}
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
  renderKonva(stage, <CanvasScene root={props.root} layers={props.layers} />);
}

export default CanvasScene;
