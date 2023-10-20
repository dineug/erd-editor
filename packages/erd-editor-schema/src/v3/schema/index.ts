import { Doc } from '@/v3/schema/doc';
import { Index } from '@/v3/schema/index.entity';
import {
  IndexColumn,
  OrderType,
  OrderTypeList,
} from '@/v3/schema/indexColumn.entity';
import { LWW } from '@/v3/schema/lww';
import { Memo } from '@/v3/schema/memo.entity';
import {
  Direction,
  DirectionList,
  Relationship,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v3/schema/relationship.entity';
import {
  BracketType,
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
  CanvasTypeList,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  Settings,
  Show,
} from '@/v3/schema/settings';
import { Table } from '@/v3/schema/table.entity';
import {
  Column,
  ColumnOption,
  ColumnUIKey,
} from '@/v3/schema/tableColumn.entity';

export interface ERDEditorSchemaV3 {
  version: '3.0.0';
  settings: Settings;
  doc: Doc;
  collections: {
    tableEntities: Record<string, Table>;
    tableColumnEntities: Record<string, Column>;
    relationshipEntities: Record<string, Relationship>;
    indexEntities: Record<string, Index>;
    indexColumnEntities: Record<string, IndexColumn>;
    memoEntities: Record<string, Memo>;
  };
  lww: LWW;
}

export const SchemaV3Constants = {
  CanvasType,
  CanvasTypeList,
  Show,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  BracketType,
  BracketTypeList,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
  Direction,
  DirectionList,
  ColumnOption,
  ColumnUIKey,
  OrderType,
  OrderTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
} as const;
