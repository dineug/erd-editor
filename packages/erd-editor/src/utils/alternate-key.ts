import { query } from '@dineug/erd-editor-schema';
import { Collections } from '@/internal-types';

/**
 * Get the alternate key (AK) group number for a specific column
 * Returns { akGroupNumber: number, position: number } or null if column is not part of an AK
 * Example: { akGroupNumber: 1, position: 1 } means AK 1.1
 */
export function getColumnAlternateKey(
  columnId: string,
  tableId: string,
  collections: Collections
): { akGroupNumber: number; position: number } | null {
  const { indexEntities, indexColumnEntities, columnEntities } = collections;

  // Get all unique indexes for this table, ordered by their creation
  const uniqueIndexes = Object.values(indexEntities)
    .filter(index => index.tableId === tableId && index.unique)
    .sort((a, b) => a.id.localeCompare(b.id)); // Sort by ID for consistent ordering

  // Find which AK group this column belongs to
  for (let akGroupNumber = 1; akGroupNumber <= uniqueIndexes.length; akGroupNumber++) {
    const index = uniqueIndexes[akGroupNumber - 1];
    const indexColumns = index.seqIndexColumnIds
      .map(id => indexColumnEntities[id])
      .filter(Boolean);

    // Find position of this column in the index
    const position = indexColumns.findIndex(ic => ic.columnId === columnId) + 1;
    if (position > 0) {
      return { akGroupNumber, position };
    }
  }

  return null;
}

/**
 * Get all alternate key information for a column
 * Returns an array of AK labels like ["AK 1.1", "AK 2.2"] if column is part of multiple AKs
 */
export function getColumnAlternateKeyLabels(
  columnId: string,
  tableId: string,
  collections: Collections
): string[] {
  const ak = getColumnAlternateKey(columnId, tableId, collections);
  if (!ak) return [];
  return [`AK ${ak.akGroupNumber}.${ak.position}`];
}
