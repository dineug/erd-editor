import { ValuesType } from '@/internal-types';

export const Open = {
  automaticTablePlacement: 'automaticTablePlacement',
  tableProperties: 'tableProperties',
  search: 'search',
  themeBuilder: 'themeBuilder',
  diffViewer: 'diffViewer',
  timeTravel: 'timeTravel',
  findReplace: 'findReplace',
  exportImage: 'exportImage',
} as const;
export type Open = ValuesType<typeof Open>;
