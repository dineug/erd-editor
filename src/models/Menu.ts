import {ShowKey} from '@/store/canvas';
import {Database} from '@/data/dataType';

export interface MenuOption {
  close?: boolean;
  show?: ShowKey;
  database?: Database;
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
