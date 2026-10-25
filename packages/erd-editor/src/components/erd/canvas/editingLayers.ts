import type { CanvasLayers } from '@/components/erd/canvas/CanvasScene';
import ColumnDragGhost from '@/components/erd/canvas/column-drag-ghost/ColumnDragGhost';
import DragSelect from '@/components/erd/canvas/drag-select/DragSelect';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import DuplicateGhost from '@/components/erd/canvas/duplicate-ghost/DuplicateGhost';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import TableGroupDropTarget from '@/components/erd/canvas/table-group/TableGroupDropTarget';

/**
 * What the ERD tab's scene draws beside the document: a relationship being
 * drawn, a drag's drop into groups, the marquee, collaborators and drag ghosts.
 * Handed in through the canvas, so a scene that edits nothing reaches none.
 */
export const editingLayers: CanvasLayers = {
  relationshipDraw: DrawRelationship,
  dropTarget: TableGroupDropTarget,
  marquee: DragSelect,
  presence: [
    SharedMouseTracker,
    SharedDragSelect,
    DuplicateGhost,
    ColumnDragGhost,
  ],
};
