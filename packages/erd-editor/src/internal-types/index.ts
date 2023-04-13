import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';

export type ValuesType<T extends Record<string, string>> = T[keyof T];

type GetEntity<T extends keyof ERDEditorSchemaV3['collections']> = Exclude<
  ERDEditorSchemaV3['collections'][T][keyof ERDEditorSchemaV3['collections'][T]],
  undefined
>;

type GetEntities<T extends keyof ERDEditorSchemaV3['collections']> =
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

export type Settings = ERDEditorSchemaV3['settings'];

export type Point = {
  x: number;
  y: number;
};
