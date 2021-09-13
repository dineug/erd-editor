import {
  mdiFileCode,
  mdiFileFind,
  mdiFileQuestion,
  mdiMinus,
  mdiPlus,
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
  createMDI('plus', mdiPlus),
  createMDI('minus', mdiMinus),
  createMDI('file-question', mdiFileQuestion),
] as IconDefinition[];

const iconMap = icons.reduce<Record<string, IconDefinition>>((acc, cur) => {
  acc[`${cur.prefix}-${cur.iconName}`] = cur;
  return acc;
}, {});

export const getIcon = (
  prefix: string,
  iconName: string
): IconDefinition | undefined => iconMap[`${prefix}-${iconName}`];
