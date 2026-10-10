/**
 * A named, coloured rectangle drawn behind tables; a table joins one through
 * its own groupId, so the group holds no list of members.
 */
export type TableGroup = {
  id: string;
  name: string;
  color: string;
  ui: TableGroupUI;
};

export type TableGroupUI = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};
