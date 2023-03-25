import {
  BracketType,
  BracketTypeList,
  CanvasEntity,
  CanvasType,
  CanvasTypeList,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  HighlightTheme,
  HighlightThemeList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
} from '@/v2/schema/canvasEntity';
import { MemoEntity } from '@/v2/schema/memoEntity';
import {
  Direction,
  DirectionList,
  RelationshipEntity,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v2/schema/relationshipEntity';
import { OrderType, OrderTypeList, TableEntity } from '@/v2/schema/tableEntity';

export interface ERDEditorSchemaV2 {
  canvas: CanvasEntity;
  table: TableEntity;
  memo: MemoEntity;
  relationship: RelationshipEntity;
}

export const SchemaV2Constants = {
  BracketType,
  BracketTypeList,
  CanvasType,
  CanvasTypeList,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  HighlightTheme,
  HighlightThemeList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
  Direction,
  DirectionList,
  OrderType,
  OrderTypeList,
} as const;
