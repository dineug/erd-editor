import { EntityType } from '@/internal-types';

export type Memo = EntityType<{
  id: string;
  value: string;
  ui: MemoUI;
}>;

export type MemoUI = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  color: string;
};
