import { createCommand } from '@/engine/command/helper';

export const filterActive = () => createCommand('editor.filter.active', null);

export const filterActiveEnd = () =>
  createCommand('editor.filter.activeEnd', null);
