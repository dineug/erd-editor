import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { SelectType } from '@/engine/modules/editor/state';
import { Ctx, Table } from '@/internal-types';

/**
 * Where a table drag never starts. The colour bar opens the picker, a column row
 * starts its own drag, an icon is a button and a header cell takes focus, so
 * each of the four owns the gesture that lands on it.
 */
const BLOCKED_KINDS = [
  'table-header-color',
  'column-row',
  'icon',
  'input-padding',
];

export function useMoveTable(ctx: Ctx, props: { table: Table }) {
  return useMoveEntity(ctx, {
    entityId: () => props.table.id,
    selectType: SelectType.table,
    blockedKinds: BLOCKED_KINDS,
  });
}
