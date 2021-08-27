import {
  mdiFileCode,
  mdiFileFind,
  mdiTable,
  mdiViewList,
  mdiViewSplitVertical,
} from '@mdi/js';

import { IconDefinition } from '@/internal-types/icon';

export const createMDI = (name: string, icon: string): IconDefinition => ({
  prefix: 'mdi',
  iconName: name,
  icon: [24, 24, , , icon],
});

const icons = [
  createMDI('view-split-vertical', mdiViewSplitVertical),
  createMDI('file-find', mdiFileFind),
  createMDI('file-code', mdiFileCode),
  createMDI('table', mdiTable),
  createMDI('view-list', mdiViewList),
] as IconDefinition[];

export const getIcon = (prefix: string, iconName: string) =>
  icons.find(icon => icon.prefix === prefix && icon.iconName === iconName);
