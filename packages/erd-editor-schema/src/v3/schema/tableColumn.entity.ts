export type Column = {
  id: string;
  tableId: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  options: number;
  /** The name a reader sees in the logical view, '' for none. */
  logicalName: string;
  /** The domain that governs the data type, '' for none. */
  domainId: string;
  ui: ColumnUI;
};

export type ColumnUI = {
  keys: number;
  widthName: number;
  widthLogicalName: number;
  widthComment: number;
  widthDataType: number;
  widthDomain: number;
  widthDefault: number;
};

// Append only: a document stores the bits as one number. nameDerived is set
// while the dictionaries filled the name, so a file without it rewrites none.
export const ColumnOption = {
  autoIncrement: 1,
  primaryKey: 2,
  unique: 4,
  notNull: 8,
  nameDerived: 16,
} as const;

export const ColumnUIKey = {
  primaryKey: 1,
  foreignKey: 2,
} as const;
