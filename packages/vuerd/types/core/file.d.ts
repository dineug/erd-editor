import { CanvasState } from '../engine/store/canvas.state';
import { MemoState } from '../engine/store/memo.state';
import { RelationshipState } from '../engine/store/relationship.state';
import { TableState } from '../engine/store/table.state';

export interface JsonFormat {
  canvas: CanvasState;
  table: TableState;
  memo: MemoState;
  relationship: RelationshipState;
}

export declare function setExportFileCallback(
  callback: (blob: Blob, fileName: string) => void
): void;
