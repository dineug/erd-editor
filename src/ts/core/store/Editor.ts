import { FocusTable, FocusType } from "../model/FocusTableModel";
import {
  FocusFilter,
  FocusType as FocusFilterType,
} from "../model/FocusFilterModel";
import { DraggableColumn, DraggableFilterState } from "../command/editor";
import { Table, Column } from "./Table";
import { RelationshipType } from "./Relationship";
import { Point } from "../helper/RelationshipHelper";

export interface EditorState {
  focus: boolean;
  focusTable: FocusTable | null;
  editTable: EditTable | null;
  draggableColumn: DraggableColumn | null;
  drawRelationship: DrawRelationship | null;
  copyColumns: Column[];
  findActive: boolean;
  filterActive: boolean;
  filterStateList: FilterState[];
  filterOperatorType: FilterOperatorType;
  focusFilter: FocusFilter | null;
  editFilter: EditFilter | null;
  draggableFilterState: DraggableFilterState | null;
}

export interface EditTable {
  id: string;
  focusType: FocusType;
}

export interface DrawRelationship {
  relationshipType: RelationshipType;
  start: DrawStartPoint | null;
  end: Point;
}

export interface DrawStartPoint {
  table: Table;
  x: number;
  y: number;
}

export type FilterColumnType =
  | "tableName"
  | "tableComment"
  | "option"
  | "name"
  | "dataType"
  | "default"
  | "comment";
export const filterColumnTypes: FilterColumnType[] = [
  "tableName",
  "tableComment",
  "option",
  "name",
  "dataType",
  "default",
  "comment",
];
export type TextFilterCode = "eq" | "ne" | "contain" | "start" | "end";
export const textFilterCodeList: TextFilterCode[] = [
  "eq",
  "ne",
  "contain",
  "start",
  "end",
];
export type FilterOperatorType = "AND" | "OR";
export const filterOperatorTypes: FilterOperatorType[] = ["AND", "OR"];
export interface FilterState {
  id: string;
  columnType: FilterColumnType;
  filterCode: TextFilterCode;
  value: string;
}

export interface EditFilter {
  id?: string | null;
  focusType: FocusFilterType;
}

export function createEditorState(): EditorState {
  return {
    focus: true,
    focusTable: null,
    editTable: null,
    draggableColumn: null,
    drawRelationship: null,
    copyColumns: [],
    findActive: false,
    filterActive: false,
    filterStateList: [],
    filterOperatorType: "OR",
    focusFilter: null,
    editFilter: null,
    draggableFilterState: null,
  };
}
