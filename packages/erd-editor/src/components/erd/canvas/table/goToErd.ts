import { goToErdTarget } from '@/components/erd/goToErdTarget';
import type { RxStore } from '@/engine/rx-store';

/**
 * The Go to ERD button's whole errand, a jump from outside the canvas like any
 * other: the tab in one dispatch, then the scroll and the selection, which
 * never starts or finishes a relationship being drawn.
 *
 * @example
 * goToErdTable(store, 'orders');
 */
export function goToErdTable(store: RxStore, tableId: string): void {
  goToErdTarget(store, { kind: 'table', tableId });
}
