import { ValuesType } from '@/internal-types';

/**
 * How the editor lays a document out when the author asks it to. Force is the
 * simulation the editor has always run, and the three below it are ELK
 * algorithms answered off the main thread.
 */
export const TablePlacement = {
  force: 'force',
  layeredHorizontal: 'layeredHorizontal',
  layeredVertical: 'layeredVertical',
  flow: 'flow',
} as const;
export type TablePlacement = ValuesType<typeof TablePlacement>;

export const DEFAULT_TABLE_PLACEMENT: TablePlacement = TablePlacement.force;
