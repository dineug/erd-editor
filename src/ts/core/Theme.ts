export interface Theme {
  canvas: string;
  table: string;
  tableActive: string;
  focus: string;
  keyPK: string;
  keyFK: string;
  keyPFK: string;
  relationshipActive: string;
  font: string;
  fontActive: string;
  fontPlaceholder: string;
  contextmenu: string;
  contextmenuActive: string;
  edit: string;
  mark: string;
  columnSelect: string;
  columnActive: string;
  minimapShadow: string;
  minimapHandle: string;
  scrollBarThumb: string;
  scrollBarThumbActive: string;
  code: string;
  dragSelect: string;
  menubar: string;
  visualization: string;
}

export function createTheme(): Theme {
  return {
    canvas: "#282828",
    table: "#191919",
    tableActive: "#14496d",
    focus: "#00a9ff",
    keyPK: "#B4B400",
    keyFK: "#dda8b1",
    keyPFK: "#60b9c4",
    relationshipActive: "#ffc107",
    font: "#a2a2a2",
    fontActive: "white",
    fontPlaceholder: "#6D6D6D",
    contextmenu: "#191919",
    contextmenuActive: "#383d41",
    edit: "#ffc107",
    mark: "#ffc107",
    columnSelect: "#232a2f",
    columnActive: "#372908",
    minimapShadow: "black",
    minimapHandle: "#ffc107",
    scrollBarThumb: "#6D6D6D",
    scrollBarThumbActive: "#a2a2a2",
    code: "#23241f",
    dragSelect: "#0098ff",
    menubar: "#191919",
    visualization: "#191919",
  };
}
