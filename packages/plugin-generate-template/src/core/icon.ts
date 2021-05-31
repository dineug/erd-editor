import { IconDefinition } from '@/internal-types/icon';
import { mdiViewSplitVertical, mdiFileFind, mdiFileCode } from '@mdi/js';

export const createMDI = (name: string, icon: string): IconDefinition => ({
  prefix: 'mdi',
  iconName: name,
  icon: [24, 24, , , icon],
});

const icons = [
  createMDI('view-split-vertical', mdiViewSplitVertical),
  createMDI('file-find', mdiFileFind),
  createMDI('file-code', mdiFileCode),
] as IconDefinition[];

export const getIcon = (prefix: string, iconName: string) =>
  icons.find(icon => icon.prefix === prefix && icon.iconName === iconName);
