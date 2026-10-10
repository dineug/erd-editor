import { Doc } from '@/v3/schema/doc';
import { Index } from '@/v3/schema/index.entity';
import {
  IndexColumn,
  OrderType,
  OrderTypeList,
} from '@/v3/schema/indexColumn.entity';
import { Memo } from '@/v3/schema/memo.entity';
import {
  Direction,
  DirectionList,
  ReferentialAction,
  ReferentialActionList,
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
  DDLScriptPosition,
  DDLScriptPositionList,
  Language,
  LanguageList,
  LockSettingFields,
  LockSettingType,
  LockSettingTypeList,
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
import { TableGroup } from '@/v3/schema/tableGroup.entity';

export interface ERDEditorSchemaV3 {
  $schema: 'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';
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
    tableGroupEntities: Record<string, TableGroup>;
  };
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
  ReferentialAction,
  ReferentialActionList,
  Direction,
  DirectionList,
  ColumnOption,
  ColumnUIKey,
  OrderType,
  OrderTypeList,
  LockSettingType,
  LockSettingTypeList,
  LockSettingFields,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  DDLScriptPosition,
  DDLScriptPositionList,
} as const;
