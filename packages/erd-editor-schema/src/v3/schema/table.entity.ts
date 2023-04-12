import { EntityType } from '@/internal-types';

export type Table = EntityType<{
  id: string;
  name: string;
  comment: string;
  columnIds: string[];
  ui: TableUI;
}>;

export type TableUI = {
  top: number;
  left: number;
  zIndex: number;
  widthName: number;
  widthComment: number;
  color: string;
};
