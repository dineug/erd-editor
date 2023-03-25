export interface Index {
  id: string;
  name: string;
  tableId: string;
  indexColumnIds: string[];
  unique: boolean;
}
