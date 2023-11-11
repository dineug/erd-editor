import { useAppContext } from '@/components/context';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { Ctx, Table } from '@/internal-types';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

export function useMoveTable(ctx: Ctx, props: { table: Table }) {
  const app = useAppContext(ctx);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    store.dispatch(moveAllAction$(movementX, movementY));
  };

  const onMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(selectTableAction$(props.table.id, isMod(event)));

    if (
      !el.closest('.table-header-color') &&
      !el.closest('.column-row') &&
      !el.closest('.icon') &&
      !el.closest('.input-padding')
    ) {
      drag$.subscribe(handleMove);
    }
  };

  return {
    onMoveStart,
  };
}
