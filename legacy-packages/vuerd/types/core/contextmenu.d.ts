import { Icon } from './panel';

export interface MenuOptions {
  nameWidth?: number;
  keymapWidth?: number;
  close?: boolean;
}

export interface Menu {
  name: string;
  keymap?: string;
  keymapTooltip?: string;
  icon?: Icon;
  iconBase64?: string;
  children?: Menu[];
  options?: MenuOptions;
  execute?(): void;
}
