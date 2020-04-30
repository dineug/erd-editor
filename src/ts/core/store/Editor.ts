import { FocusTable, FocusType } from "../model/FocusTableModel";
import { DraggableColumn } from "../command/editor";
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

export function createEditorState(): EditorState {
  return {
    focus: true,
    focusTable: null,
    editTable: null,
    draggableColumn: null,
    drawRelationship: null,
    copyColumns: [],
  };
}
