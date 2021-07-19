export interface Theme {
  canvas: string;
  table: string;
  tableActive: string;
  focus: string;
  keyPK: string;
  keyFK: string;
  keyPFK: string;
  font: string;
  fontActive: string;
  fontPlaceholder: string;
  contextmenu: string;
  contextmenuActive: string;
  edit: string;
  columnSelect: string;
  columnActive: string;
  minimapShadow: string;
  scrollbarThumb: string;
  scrollbarThumbActive: string;
  menubar: string;
  visualization: string;
  diffAdd: string;
  diffModify: string;
  diffRemove: string;
}

export type ThemeKey = keyof Theme;
