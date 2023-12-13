import { EntityType } from '@/internal-types';

export type Table = EntityType<{
  id: string;
  name: string;
  comment: string;
  columnIds: string[];
  seqColumnIds: string[];
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
