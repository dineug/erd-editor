import type { Ref } from '@dineug/r-html';

import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { SelectType } from '@/engine/modules/editor/state';
import { Ctx, Table } from '@/internal-types';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * Where a table drag never starts: the colour edge opens the picker, a column
 * row starts its own drag and an icon is a button.
 */
const BLOCKED_KINDS = ['table-header-color', 'column-row', 'icon'];

/**
 * A header cell takes focus and carries the table too, once the pointer has
 * travelled, since the same press doubled is what opens its editor.
 */
const CLICK_KINDS = ['input-padding'];

/**
 * Where a view card's drag never starts: its two header buttons. A view draws
 * no colour edge to press, reorders no row and focuses no cell, so everywhere
 * else on the card is the card, and a reader takes it by any of it.
 */
const VIEW_BLOCKED_KINDS = ['icon'];

export function useMoveTable(
  ctx: Ctx,
  props: { table: Table },
  source: Ref<GeometrySource>
) {
  return useMoveEntity(ctx, {
    entityId: () => props.table.id,
    selectType: SelectType.table,
    blockedKinds: scene =>
      scene === 'document' ? BLOCKED_KINDS : VIEW_BLOCKED_KINDS,
    clickKinds: scene => (scene === 'document' ? CLICK_KINDS : []),
    source,
  });
}
