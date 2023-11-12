import { arrayHas } from '@dineug/shared';

import { Direction } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Relationship, RelationshipPoint, Table } from '@/internal-types';
import { query } from '@/utils/collection/query';
import {
  DirectionName,
  DirectionNameList,
  ObjectPoint,
  RelationshipMarginPoint,
  RelationshipOrder,
} from '@/utils/draw-relationship';
import {
  euclideanDistance,
  tableToObjectPoint,
} from '@/utils/draw-relationship/calc';

type RelationshipGraph = {
  table: Table;
  objectPoint: ObjectPoint;
  top: Map<string, Relationship>;
  bottom: Map<string, Relationship>;
  left: Map<string, Relationship>;
  right: Map<string, Relationship>;
};

type DirectionTuple = [DirectionName, DirectionName];

const directionNameToDirection: Record<string, number> = {
  [DirectionName.top]: Direction.top,
  [DirectionName.bottom]: Direction.bottom,
  [DirectionName.left]: Direction.left,
  [DirectionName.right]: Direction.right,
};

export function relationshipSort(state: RootState) {
  const {
    doc: { tableIds, relationshipIds },
    collections,
  } = state;
  const isTableIds = arrayHas(tableIds);
  const tableCollection = query(collections).collection('tableEntities');
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .filter(
      ({ start, end }) => isTableIds(start.tableId) && isTableIds(end.tableId)
    );
  const graphMap = new Map<string, RelationshipGraph>();

  for (const relationship of relationships) {
    const { start, end } = relationship;
    const startTable = tableCollection.selectById(start.tableId);
    const endTable = tableCollection.selectById(end.tableId);

    if (!startTable || !endTable) {
      continue;
    }

    if (start.tableId === end.tableId) {
      start.direction = Direction.top;
      end.direction = Direction.right;

      const graph = getOrCreateGraph(state, graphMap, startTable);
      start.x = graph.objectPoint.rt.x - 20;
      start.y = graph.objectPoint.rt.y;
      end.x = graph.objectPoint.rt.x;
      end.y = graph.objectPoint.rt.y + 20;

      graph.top.set(relationship.id, relationship);
      graph.right.set(relationship.id, relationship);
    } else {
      const startGraph = getOrCreateGraph(state, graphMap, startTable);
      const endGraph = getOrCreateGraph(state, graphMap, endTable);
      const [startDirection, endDirection] = getAndSetDirection(
        startGraph.objectPoint,
        endGraph.objectPoint,
        relationship
      );

      startGraph[startDirection].set(relationship.id, relationship);
      endGraph[endDirection].set(relationship.id, relationship);
    }
  }

  for (const graph of graphMap.values()) {
    for (const key of DirectionNameList) {
      const direction = key as DirectionName;
      const size = graph[direction].size;
      if (size < 2) continue;

      relationshipOverlaySort(direction, graph);
    }
  }
}

function getOrCreateGraph(
  state: RootState,
  graphMap: Map<string, RelationshipGraph>,
  table: Table
) {
  let graph = graphMap.get(table.id);
  if (!graph) {
    graph = {
      table,
      objectPoint: tableToObjectPoint(state, table),
      top: new Map(),
      bottom: new Map(),
      left: new Map(),
      right: new Map(),
    };
    graphMap.set(table.id, graph);
  }
  return graph;
}

function getAndSetDirection(
  start: ObjectPoint,
  end: ObjectPoint,
  relationship: Relationship
): DirectionTuple {
  const direction: DirectionTuple = [
    DirectionName.bottom,
    DirectionName.bottom,
  ];

  let min = euclideanDistance(start.bottom, end.bottom);
  relationship.start.x = start.bottom.x;
  relationship.start.y = start.bottom.y;
  relationship.end.x = end.bottom.x;
  relationship.end.y = end.bottom.y;
  relationship.start.direction = Direction.bottom;
  relationship.end.direction = Direction.bottom;

  for (const key of DirectionNameList) {
    for (const key2 of DirectionNameList) {
      const k = key as DirectionName;
      const k2 = key2 as DirectionName;
      const temp = euclideanDistance(start[k], end[k2]);
      if (min <= temp) continue;

      min = temp;
      direction[0] = k;
      direction[1] = k2;
      relationship.start.x = start[k].x;
      relationship.start.y = start[k].y;
      relationship.start.direction = directionNameToDirection[k];
      relationship.end.x = end[k2].x;
      relationship.end.y = end[k2].y;
      relationship.end.direction = directionNameToDirection[k2];
    }
  }

  return direction;
}

function relationshipOverlaySort(
  direction: DirectionName,
  graph: RelationshipGraph
) {
  const point = relationshipOverlayPoint(direction, graph);
  const distances = relationshipOverlayOrder(direction, graph);

  if (direction === DirectionName.left || direction === DirectionName.right) {
    point.yArray.forEach((y, index) => {
      distances[index].start.y = y;
    });
  } else if (
    direction === DirectionName.top ||
    direction === DirectionName.bottom
  ) {
    point.xArray.forEach((x, index) => {
      distances[index].start.x = x;
    });
  }
}

function relationshipOverlayPoint(
  direction: DirectionName,
  graph: RelationshipGraph
): RelationshipMarginPoint {
  const size = graph[direction].size;
  const margin = {
    x: graph.objectPoint.width / size,
    y: graph.objectPoint.height / size,
  };
  const padding = {
    x: margin.x / 2,
    y: margin.y / 2,
  };
  const xArray: number[] = [];
  const yArray: number[] = [];

  if (direction === DirectionName.left || direction === DirectionName.right) {
    let sum = graph.objectPoint.lt.y - padding.y;
    for (let i = 0; i < size; i++) {
      sum += margin.y;
      yArray.push(sum);
    }
  } else if (
    direction === DirectionName.top ||
    direction === DirectionName.bottom
  ) {
    let sum = graph.objectPoint.lt.x - padding.x;
    for (let i = 0; i < size; i++) {
      sum += margin.x;
      xArray.push(sum);
    }
  }
  return {
    xArray,
    yArray,
  };
}

function relationshipOverlayOrder(
  direction: DirectionName,
  graph: RelationshipGraph
): RelationshipOrder[] {
  const startPoints: RelationshipPoint[] = [];
  const endPoints: RelationshipPoint[] = [];
  const distances: RelationshipOrder[] = [];
  const isX =
    direction === DirectionName.top || direction === DirectionName.bottom;

  for (const relationship of graph[direction].values()) {
    const { start, end } = relationship;

    if (start.tableId === end.tableId) {
      // self relationship
      if (direction === DirectionName.top) {
        startPoints.push(relationship.start);
        endPoints.push(relationship.end);
      } else if (direction === DirectionName.right) {
        startPoints.push(relationship.end);
        endPoints.push(relationship.start);
      }
    } else if (relationship.start.tableId === graph.table.id) {
      startPoints.push(relationship.start);
      endPoints.push(relationship.end);
    } else {
      startPoints.push(relationship.end);
      endPoints.push(relationship.start);
    }
  }

  endPoints.forEach((endPoint, index) => {
    distances.push({
      start: startPoints[index],
      end: endPoints[index],
      distance: isX ? endPoint.x : endPoint.y,
    });
  });

  return distances.sort((a, b) => a.distance - b.distance);
}
