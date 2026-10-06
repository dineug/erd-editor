import { code } from './code';
import { colorPicker } from './colorPicker';
import { common } from './common';
import { contextMenu } from './contextMenu';
import { exportImage } from './exportImage';
import { feedback } from './feedback';
import { findReplace } from './findReplace';
import { floatingToolbar } from './floatingToolbar';
import { mapColumns } from './mapColumns';
import { palette } from './palette';
import { settings } from './settings';
import { shortcuts } from './shortcuts';
import { tableProperties } from './tableProperties';
import { themeBuilder } from './themeBuilder';
import { toolbar } from './toolbar';
import { visualization } from './visualization';
import { welcome } from './welcome';

/**
 * The editor's own text in English, the source every other dictionary follows:
 * one file per part of the editor, each key prefixed with its file's name.
 */
export const en = {
  ...common,
  ...contextMenu,
  ...floatingToolbar,
  ...visualization,
  ...code,
  ...findReplace,
  ...tableProperties,
  ...colorPicker,
  ...palette,
  ...settings,
  ...shortcuts,
  ...exportImage,
  ...feedback,
  ...toolbar,
  ...themeBuilder,
  ...welcome,
  ...mapColumns,
} as const;
