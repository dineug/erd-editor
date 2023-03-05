import { CanvasEntity } from '@/v2/schema/canvasEntity';
import { MemoEntity } from '@/v2/schema/memoEntity';
import { RelationshipEntity } from '@/v2/schema/relationshipEntity';
import { TableEntity } from '@/v2/schema/tableEntity';

export interface ERDEditorSchemaV2 {
  canvas: CanvasEntity;
  table: TableEntity;
  memo: MemoEntity;
  relationship: RelationshipEntity;
}
