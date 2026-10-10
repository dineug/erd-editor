import type { EngineContext } from '@/engine/context';
import {
  recalculateIdentification,
  recalculateStartRelationshipType,
} from '@/engine/modules/relationship/endFlags';
import {
  syncPrimaryKeys,
  validateForeignKeys,
} from '@/engine/modules/table-column/keys';
import type { RootState } from '@/engine/state';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

/**
 * Writes every value a document derives from what it holds: the key marks, the
 * widths as this store measures them, the anchors and each relationship's
 * flags. A load runs it before its reducer returns, so no hook writes after it.
 */
export function settleDocument(state: RootState, ctx: EngineContext) {
  syncPrimaryKeys(state);
  validateForeignKeys(state);
  recalculateTableWidth(state, ctx);
  relationshipSort(state);
  recalculateIdentification(state);
  recalculateStartRelationshipType(state);
}
