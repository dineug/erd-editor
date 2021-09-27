export interface Icon {
  prefix: string;
  name: string;
  size?: number;
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

export interface MenuOptions {
  nameWidth?: number;
  keymapWidth?: number;
  close?: boolean;
}
