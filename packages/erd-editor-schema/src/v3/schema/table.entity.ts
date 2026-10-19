export type Table = {
  id: string;
  name: string;
  /** The name a reader sees in the logical view, '' for none. */
  logicalName: string;
  comment: string;
  columnIds: string[];
  seqColumnIds: string[];
  /**
   * The table group the table belongs to, '' for none; an id naming no group in
   * doc.tableGroupIds reads as none.
   */
  groupId: string;
  /**
   * True while the dictionaries filled the name, which a new logical name then
   * derives again; false for a name someone wrote, which nothing rewrites.
   */
  nameDerived: boolean;
  ui: TableUI;
};

export type TableUI = {
  x: number;
  y: number;
  zIndex: number;
  widthName: number;
  widthLogicalName: number;
  widthComment: number;
  color: string;
};
