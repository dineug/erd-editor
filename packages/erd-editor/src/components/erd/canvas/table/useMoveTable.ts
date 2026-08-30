import { useAppContext } from '@/components/appContext';
import { tryStartAltDragDuplicate } from '@/components/erd/canvas/altDragDuplicate';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
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
    const canDrag =
      !el.closest('.table-header-color') &&
      !el.closest('.column-row') &&
      !el.closest('.icon') &&
      !el.closest('.input-padding');

    // move$ is not share()d and mutates module-global prevX/prevY, so
    // a second concurrent drag$ subscriber always reads movementX === 0.
    if (
      canDrag &&
      tryStartAltDragDuplicate(
        app.value,
        event,
        props.table.id,
        SelectType.table
      )
    ) {
      return;
    }

    store.dispatch(selectTableAction$(props.table.id, isMod(event)));

    if (canDrag) {
      drag$.subscribe(handleMove);
    }
  };

  return {
    onMoveStart,
  };
}
