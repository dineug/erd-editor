import { EntityType } from '@/internal-types';

export type Table = EntityType<{
  id: string;
  name: string;
  comment: string;
  columnIds: string[];
  seqColumnIds: string[];
  /**
   * The table group the table belongs to, '' for none; an id naming no group in
   * doc.tableGroupIds reads as none.
   */
  groupId: string;
  ui: TableUI;
}>;

export type TableUI = {
  x: number;
  y: number;
  zIndex: number;
  widthName: number;
  widthComment: number;
  color: string;
};
