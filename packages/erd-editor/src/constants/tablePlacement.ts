import { ValuesType } from '@/internal-types';

/**
 * How a set of tables is laid out. Force is the simulation the editor has
 * always run, the rest are ELK algorithms answered off the main thread, and
 * viewLayered is the preset the views place with rather than one the author picks.
 */
export const TablePlacement = {
  force: 'force',
  layeredHorizontal: 'layeredHorizontal',
  layeredVertical: 'layeredVertical',
  flow: 'flow',
  viewLayered: 'viewLayered',
} as const;
export type TablePlacement = ValuesType<typeof TablePlacement>;

export const DEFAULT_TABLE_PLACEMENT: TablePlacement = TablePlacement.force;
