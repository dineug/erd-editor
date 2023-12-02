import { SchemaV3Constants } from '@dineug/erd-editor-schema';

export const CanvasType = SchemaV3Constants.CanvasType;
export const CanvasTypeList = SchemaV3Constants.CanvasTypeList;
export const Show = SchemaV3Constants.Show;
export const ColumnType = SchemaV3Constants.ColumnType;
export const ColumnTypeList = SchemaV3Constants.ColumnTypeList;
export const Database = SchemaV3Constants.Database;
export const DatabaseList = SchemaV3Constants.DatabaseList;
export const Language = SchemaV3Constants.Language;
export const LanguageList = SchemaV3Constants.LanguageList;
export const NameCase = SchemaV3Constants.NameCase;
export const NameCaseList = SchemaV3Constants.NameCaseList;
export const BracketType = SchemaV3Constants.BracketType;
export const BracketTypeList = SchemaV3Constants.BracketTypeList;
export const RelationshipType = SchemaV3Constants.RelationshipType;
export const RelationshipTypeList = SchemaV3Constants.RelationshipTypeList;
export const StartRelationshipType = SchemaV3Constants.StartRelationshipType;
export const StartRelationshipTypeList =
  SchemaV3Constants.StartRelationshipTypeList;
export const Direction = SchemaV3Constants.Direction;
export const DirectionList = SchemaV3Constants.DirectionList;
export const ColumnOption = SchemaV3Constants.ColumnOption;
export const ColumnUIKey = SchemaV3Constants.ColumnUIKey;
export const OrderType = SchemaV3Constants.OrderType;
export const OrderTypeList = SchemaV3Constants.OrderTypeList;
export const CANVAS_SIZE_MAX = SchemaV3Constants.CANVAS_SIZE_MAX;
export const CANVAS_SIZE_MIN = SchemaV3Constants.CANVAS_SIZE_MIN;
export const CANVAS_ZOOM_MAX = SchemaV3Constants.CANVAS_ZOOM_MAX;
export const CANVAS_ZOOM_MIN = SchemaV3Constants.CANVAS_ZOOM_MIN;

export const BracketTypeMap: Record<number, string> = {
  [BracketType.none]: '',
  [BracketType.backtick]: '`',
  [BracketType.doubleQuote]: '"',
  [BracketType.singleQuote]: "'",
};
