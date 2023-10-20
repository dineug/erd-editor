import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';

export type ValuesType<T extends Record<string, string>> = T[keyof T];

export type GetEntity<T extends keyof ERDEditorSchemaV3['collections']> =
  ERDEditorSchemaV3['collections'][T][keyof ERDEditorSchemaV3['collections'][T]];

export type GetEntities<T extends keyof ERDEditorSchemaV3['collections']> =
  ERDEditorSchemaV3['collections'][T];

export type Table = GetEntity<'tableEntities'>;
export type Column = GetEntity<'tableColumnEntities'>;
export type Memo = GetEntity<'memoEntities'>;
export type Relationship = GetEntity<'relationshipEntities'>;
export type Index = GetEntity<'indexEntities'>;
export type IndexColumn = GetEntity<'indexColumnEntities'>;

export type TableEntities = GetEntities<'tableEntities'>;
export type TableColumnEntities = GetEntities<'tableColumnEntities'>;
export type MemoEntities = GetEntities<'memoEntities'>;
export type RelationshipEntities = GetEntities<'relationshipEntities'>;
export type IndexEntities = GetEntities<'indexEntities'>;
export type IndexColumnEntities = GetEntities<'indexColumnEntities'>;

export type Doc = ERDEditorSchemaV3['doc'];
export type Collections = ERDEditorSchemaV3['collections'];
export type Settings = ERDEditorSchemaV3['settings'];
export type LWW = ERDEditorSchemaV3['lww'];

export type Point = {
  x: number;
  y: number;
};

export type EntityMeta = {
  updateAt: string;
  createAt: string;
};

export type Unsubscribe = () => void;
