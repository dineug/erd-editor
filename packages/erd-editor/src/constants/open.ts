import { ValuesType } from '@/internal-types';

export const Open = {
  automaticTablePlacement: 'automaticTablePlacement',
  tableProperties: 'tableProperties',
} as const;
export type Open = ValuesType<typeof Open>;
