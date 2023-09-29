import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { ValuesType } from '@/internal-types';

export type Editor = {
  selectedMap: Record<string, SelectType>;
  hasUndo: boolean;
  hasRedo: boolean;
  viewport: Viewport;
};

export type Viewport = {
  width: number;
  height: number;
};

export const SelectType = {
  table: 'table',
  memo: 'memo',
} as const;
export type SelectType = ValuesType<typeof SelectType>;

export const createEditor = (): Editor => ({
  selectedMap: {},
  hasUndo: false,
  hasRedo: false,
  viewport: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  },
});
