import type { Memo, Table } from '@/internal-types';

/** A table or a memo in the one stack both share, told apart by kind. */
export type StackedEntity =
  | { kind: 'table'; entity: Table }
  | { kind: 'memo'; entity: Memo };

/**
 * Tables and memos in the one order the scene paints them, lowest z-index first, as nextZIndex
 * counts them in one sequence. A memo stands over a table of the same z-index, as the scene drew
 * every memo over every table before tables and memos shared one stack.
 *
 * @example
 * stackTablesAndMemos(tables, memos).map(({ kind, entity }) => `${kind}:${entity.id}`);
 */
export function stackTablesAndMemos(
  tables: ReadonlyArray<Table>,
  memos: ReadonlyArray<Memo>
): StackedEntity[] {
  const stack: StackedEntity[] = [
    ...tables.map(entity => ({ kind: 'table' as const, entity })),
    ...memos.map(entity => ({ kind: 'memo' as const, entity })),
  ];

  return stack.sort((a, b) => a.entity.ui.zIndex - b.entity.ui.zIndex);
}

/** The repeat key of a stacked entity, its kind beside its id. */
export const stackedKey = ({ kind, entity }: StackedEntity) =>
  `${kind}:${entity.id}`;
