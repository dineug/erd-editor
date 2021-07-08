export interface RefreshTree {
  id: string;
}

export interface HideTree {
  id: string;
}

export interface TreeCommandMap {
  'tree.refresh': RefreshTree;
  'tree.hide': HideTree;
}
