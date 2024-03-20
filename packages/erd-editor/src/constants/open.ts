import { ValuesType } from '@/internal-types';

export const Open = {
  automaticTablePlacement: 'automaticTablePlacement',
  tableProperties: 'tableProperties',
  search: 'search',
  themeBuilder: 'themeBuilder',
  diffViewer: 'diffViewer',
  timeTravel: 'timeTravel',
} as const;
export type Open = ValuesType<typeof Open>;
