import { DeepPartial } from '@/internal-types';
import { createAndMergeCanvasEntity } from '@/v2/parser/canvas';
import { createAndMergeMemoEntity } from '@/v2/parser/memo';
import { createAndMergeRelationshipEntity } from '@/v2/parser/relationship';
import { createAndMergeTableEntity } from '@/v2/parser/table';
import { ERDEditorSchemaV2 } from '@/v2/schema';

export function parser(source: any): ERDEditorSchemaV2 {
  const json: DeepPartial<ERDEditorSchemaV2> = source;

  const canvas = createAndMergeCanvasEntity(json.canvas);
  const table = createAndMergeTableEntity(json.table);
  const relationship = createAndMergeRelationshipEntity(json.relationship);
  const memo = createAndMergeMemoEntity(json.memo);

  return { canvas, table, relationship, memo };
}
