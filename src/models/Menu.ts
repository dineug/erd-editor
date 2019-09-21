import {ShowKey} from '@/store/canvas';

export interface MenuOption {
  close?: boolean;
  show?: ShowKey;
}

export default interface Menu {
  readonly id: string;
  name: string;
  keymap?: string;
  icon?: string;
  base64?: boolean;
  children?: Menu[];
  option?: MenuOption;

  execute?(): void;
}
