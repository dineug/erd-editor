import { ValuesType } from '@/internal-types';

export const Open = {
  automaticTablePlacement: 'automaticTablePlacement',
  tableProperties: 'tableProperties',
  search: 'search',
  themeBuilder: 'themeBuilder',
  localePicker: 'localePicker',
  diffViewer: 'diffViewer',
  timeTravel: 'timeTravel',
  exportImage: 'exportImage',
  mapColumns: 'mapColumns',
} as const;
export type Open = ValuesType<typeof Open>;
