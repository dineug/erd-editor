import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, Ref, repeat, watch } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import { debounceTime, Observable } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import Icon from '@/components/primitives/icon/Icon';
import { moveToMemoAction } from '@/engine/modules/memo/atom.actions';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Memo, Point, Table, ValuesType } from '@/internal-types';
import { toScenePoint, toScreenPoint } from '@/konva/scene/viewport';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { isOverlapPosition } from '@/utils/dragSelect';
import { isMod } from '@/utils/keyboard-shortcut';

import * as styles from './HideSign.styles';
import { getReachableRect } from './hideSignBounds';

export type HideSignProps = {
  root: Ref<HTMLDivElement>;
};

const ROTATE = 45;

const Position = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  lt: 'lt',
  rt: 'rt',
  lb: 'lb',
  rb: 'rb',
} as const;
type Position = ValuesType<typeof Position>;

const positionToRotateMap: Record<Position, number> = {
  [Position.lt]: 3 * ROTATE,
  [Position.rt]: 5 * ROTATE,
  [Position.lb]: ROTATE,
  [Position.rb]: 7 * ROTATE,
  [Position.left]: 2 * ROTATE,
  [Position.right]: 6 * ROTATE,
  [Position.top]: 4 * ROTATE,
  [Position.bottom]: 0,
};

const HideSign: FC<HideSignProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    scrollLeft: 0,
    scrollTop: 0,
  });

  const getPosition = ({ x, y }: Point): Position => {
    const { store } = app.value;
    const {
      settings: { width, height },
    } = store.state;

    if (x < 0 && y < 0) return Position.lt;
    if (x > width && y < 0) return Position.rt;
    if (x < 0 && y > height) return Position.lb;
    if (x > width && y > height) return Position.rb;
    if (x < 0) return Position.left;
    if (x > width) return Position.right;
    if (y < 0) return Position.top;
    if (y > height) return Position.bottom;
    return Position.bottom;
  };

  /**
   * A sign is pinned to the edge of the editor box the scene is drawn in, so
   * the axis it is free on is the entity read through the very origin that box
   * places the scene layers at, and the scroll it carries is the debounced one.
   */
  const getPositionStyle = (point: Point): [Record<string, string>, number] => {
    const { store } = app.value;
    const {
      settings: { width, height, zoomLevel },
    } = store.state;
    const { scrollLeft, scrollTop } = state;
    const screen = toScreenPoint(
      { width, height, zoomLevel, scrollLeft, scrollTop },
      point
    );
    const top = `${screen.y}px`;
    const left = `${screen.x}px`;
    const position = getPosition(point);
    const rotate = positionToRotateMap[position];

    switch (position) {
      case Position.lt:
        return [{ left: '0', top: '0' }, rotate];
      case Position.rt:
        return [{ right: '0', top: '0' }, rotate];
      case Position.lb:
        return [{ left: '0', bottom: '0' }, rotate];
      case Position.rb:
        return [{ right: '0', bottom: '0' }, rotate];
      case Position.left:
        return [{ left: '0', top }, rotate];
      case Position.right:
        return [{ right: '0', top }, rotate];
      case Position.top:
        return [{ left, top: '0' }, rotate];
      case Position.bottom:
        return [{ left, bottom: '0' }, rotate];
    }
  };

  /** Where the click landed, inverted back through that same origin. */
  const getMoveToPoint = (event: MouseEvent): Point => {
    const $root = props.root.value;
    const { store } = app.value;
    const { settings } = store.state;
    const rect = $root.getBoundingClientRect();

    return toScenePoint(settings, {
      x: event.clientX - rect.x,
      y: event.clientY - rect.y,
    });
  };

  const handleMoveToTable = (event: MouseEvent, table: Table) => {
    const { store } = app.value;
    const position = getPosition(table.ui);
    const { x, y } = getMoveToPoint(event);

    let w = 0;
    let h = 0;

    switch (position) {
      case Position.rt:
        w = calcTableWidths(table, store.state).width;
        break;
      case Position.lb:
        h = calcTableHeight(table);
        break;
      case Position.rb:
        w = calcTableWidths(table, store.state).width;
        h = calcTableHeight(table);
        break;
      case Position.right:
        w = calcTableWidths(table, store.state).width;
        break;
      case Position.bottom:
        h = calcTableHeight(table);
        break;
    }

    store.dispatch(
      moveToTableAction({ id: table.id, x: x - w, y: y - h }),
      selectTableAction$(table.id, isMod(event))
    );
  };

  const handleMoveToMemo = (event: MouseEvent, memo: Memo) => {
    const { store } = app.value;
    const position = getPosition(memo.ui);
    const { x, y } = getMoveToPoint(event);

    let w = 0;
    let h = 0;

    switch (position) {
      case Position.rt:
        w = calcMemoWidth(memo);
        break;
      case Position.lb:
        h = calcMemoHeight(memo);
        break;
      case Position.rb:
        w = calcMemoWidth(memo);
        h = calcMemoHeight(memo);
        break;
      case Position.right:
        w = calcMemoWidth(memo);
        break;
      case Position.bottom:
        h = calcMemoHeight(memo);
        break;
    }

    store.dispatch(
      moveToMemoAction({ id: memo.id, x: x - w, y: y - h }),
      selectMemoAction$(memo.id, isMod(event))
    );
  };

  onMounted(() => {
    const { store } = app.value;
    const { settings } = store.state;
    const scroll$ = new Observable<{ scrollLeft: number; scrollTop: number }>(
      subscriber =>
        watch(settings).subscribe(propName => {
          if (propName === 'scrollLeft' || propName === 'scrollTop') {
            subscriber.next({
              scrollLeft: settings.scrollLeft,
              scrollTop: settings.scrollTop,
            });
          }
        })
    );

    addUnsubscribe(
      scroll$.pipe(debounceTime(100)).subscribe(({ scrollLeft, scrollTop }) => {
        state.scrollLeft = scrollLeft;
        state.scrollTop = scrollTop;
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      doc: { tableIds, memoIds },
      settings,
      editor: { viewport },
      collections,
    } = store.state;

    const rect = getReachableRect(settings, viewport);

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds)
      .filter(
        table =>
          !isOverlapPosition(rect, {
            x: table.ui.x,
            y: table.ui.y,
            w: calcTableWidths(table, store.state).width,
            h: calcTableHeight(table),
          })
      );

    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .filter(
        memo =>
          !isOverlapPosition(rect, {
            x: memo.ui.x,
            y: memo.ui.y,
            w: calcMemoWidth(memo),
            h: calcMemoHeight(memo),
          })
      );

    if (tables.length === 0 && memos.length === 0) {
      return null;
    }

    return (
      <>
        {repeat(
          tables,
          table => table.id,
          table => {
            const [style, rotate] = getPositionStyle(table.ui);
            const isEmptyName = isEmpty(table.name.trim());
            return (
              <div
                class={['hide-sign', styles.sign]}
                title={isEmptyName ? 'unnamed' : table.name}
                style={style}
                on:click={(event: MouseEvent) =>
                  handleMoveToTable(event, table)
                }
              >
                <Icon name="map-pin" rotate={rotate} />
              </div>
            );
          }
        )}
        {repeat(
          memos,
          memo => memo.id,
          memo => {
            const [style, rotate] = getPositionStyle(memo.ui);
            return (
              <div
                class={['hide-sign', styles.sign]}
                title="Memo"
                style={style}
                on:click={(event: MouseEvent) => handleMoveToMemo(event, memo)}
              >
                <Icon name="map-pin" rotate={rotate} />
              </div>
            );
          }
        )}
      </>
    );
  };
};

export default HideSign;
