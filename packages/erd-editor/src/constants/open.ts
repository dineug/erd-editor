import { ValuesType } from '@/internal-types';

export const Open = {
  automaticTablePlacement: 'automaticTablePlacement',
  tableProperties: 'tableProperties',
  search: 'search',
  themeBuilder: 'themeBuilder',
} as const;
export type Open = ValuesType<typeof Open>;
