import { EntityType } from '@/internal-types';

export type Memo = EntityType<{
  id: string;
  value: string;
  ui: MemoUI;
}>;

export type MemoUI = {
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
  color: string;
};
