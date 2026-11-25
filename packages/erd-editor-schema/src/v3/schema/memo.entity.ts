export type Memo = {
  id: string;
  value: string;
  /**
   * The table group the memo belongs to, '' for none; an id naming no group in
   * doc.tableGroupIds reads as none.
   */
  groupId: string;
  ui: MemoUI;
};

export type MemoUI = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  color: string;
};
