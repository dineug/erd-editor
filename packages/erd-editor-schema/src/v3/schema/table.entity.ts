export interface Table {
  id: string;
  name: string;
  comment: string;
  columnIds: string[];
  ui: TableUI;
}

export interface TableUI {
  top: number;
  left: number;
  zIndex: number;
  widthName: number;
  widthComment: number;
  color: string;
}
