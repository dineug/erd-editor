import { Table } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { getCoordinate } from '@/engine/store/helper/relationship.helper';
import { getIndex } from '@/core/helper';

export function virtualTable(
  current: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  },
  table: Table
): boolean {
  const { minX, minY, maxX, maxY } = current;
  const coordinate = getCoordinate(table);
  return (
    (minX < coordinate.lt.x &&
      coordinate.lt.x < maxX &&
      minY < coordinate.lt.y &&
      coordinate.lt.y < maxY) ||
    (minX < coordinate.lb.x &&
      coordinate.lb.x < maxX &&
      minY < coordinate.lb.y &&
      coordinate.lb.y < maxY) ||
    (minX < coordinate.rt.x &&
      coordinate.rt.x < maxX &&
      minY < coordinate.rt.y &&
      coordinate.rt.y < maxY) ||
    (minX < coordinate.rb.x &&
      coordinate.rb.x < maxX &&
      minY < coordinate.rb.y &&
      coordinate.rb.y < maxY)
  );
}

export function orderByNameASC(tables: Table[]): Table[] {
  return [...tables].sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (nameA < nameB) {
      return -1;
    } else if (nameA > nameB) {
      return 1;
    }
    return 0;
  });
}

export function orderByRelationship(
  tables: Table[],
  relationships: Relationship[]
): Table[] {
  const firstTables: Table[] = [];
  const reshapeTables: Table[] = [];
  const sortTables: Table[] = [];
  tables.forEach(table => {
    const endRelationships = relationships
      .filter(relationship => relationship.end.tableId === table.id)
      .map(relationship => relationship.start.tableId);
    if (endRelationships.length === 0) {
      firstTables.push(table);
    } else {
      reshapeTables.push(table);
      sortTables.push(table);
    }
  });

  reshapeTables.forEach(table => {
    const firstIndex = firstTableIndex(
      sortTables,
      relationships
        .filter(relationship => relationship.start.tableId === table.id)
        .map(relationship => relationship.end.tableId)
    );
    const currentIndex = getIndex(sortTables, table.id);
    if (currentIndex !== -1) {
      sortTables.splice(currentIndex, 1);
    }
    sortTables.splice(firstIndex, 0, table);
  });

  return [...firstTables, ...sortTables];
}

function firstTableIndex(tables: Table[], tableIds: string[]): number {
  let index = tables.length - 1;
  for (let i = 0; i < tables.length; i++) {
    const id = tables[i].id;
    if (tableIds.includes(id)) {
      index = i;
      break;
    }
  }
  return index;
}
