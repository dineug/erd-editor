import { createRef, FC, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getScrollRanges,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';

import { trackPointToScroll, useVirtualScroll } from './useVirtualScroll';
import * as styles from './VirtualScroll.styles';

export type VirtualScrollProps = {};

const VirtualScroll: FC<VirtualScrollProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const {
    state,
    getHorizontalTrack,
    getVerticalTrack,
    onScrollLeftStart,
    onScrollTopStart,
  } = useVirtualScroll(ctx);
  const horizontal = createRef<HTMLDivElement>();
  const vertical = createRef<HTMLDivElement>();

  const handleMoveLeft = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canMove = !el.closest('.virtual-scroll-ghost-thumb');
    if (!canMove) return;

    const { store } = app.value;
    const {
      editor: { viewport },
      settings,
    } = store.state;
    const { left } = getScrollRanges(settings, viewport);
    const { ratio } = getHorizontalTrack();
    const rect = horizontal.value.getBoundingClientRect();

    store.dispatch(
      scrollToAction({
        scrollLeft: trackPointToScroll(
          left,
          ratio,
          event.clientX - rect.x,
          viewport.width
        ),
        scrollTop: settings.scrollTop,
      })
    );

    onScrollLeftStart(event);
  };

  const handleMoveTop = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canMove = !el.closest('.virtual-scroll-ghost-thumb');
    if (!canMove) return;

    const { store } = app.value;
    const {
      editor: { viewport },
      settings,
    } = store.state;
    const { top } = getScrollRanges(settings, viewport);
    const { ratio } = getVerticalTrack();
    const rect = vertical.value.getBoundingClientRect();

    store.dispatch(
      scrollToAction({
        scrollLeft: settings.scrollLeft,
        scrollTop: trackPointToScroll(
          top,
          ratio,
          event.clientY - rect.y,
          viewport.height
        ),
      })
    );

    onScrollTopStart(event);
  };

  return () => {
    const horizontalTrack = getHorizontalTrack();
    const verticalTrack = getVerticalTrack();

    return (
      <>
        {horizontalTrack.scrollable ? (
          <div
            class={['virtual-scroll', styles.horizontal]}
            use:ref={ref(horizontal)}
            on:mousedown={handleMoveLeft}
          >
            <div
              class={['virtual-scroll-ghost-thumb', styles.ghostThumb]}
              style={{
                width: `${horizontalTrack.thumb}px`,
                height: '100%',
                transform: `translate(${horizontalTrack.offset}px, 0px)`,
              }}
              bool:data-selected={state.selected === 'horizontal'}
              on:mousedown={onScrollLeftStart}
            >
              <div class={styles.horizontalThumb}></div>
            </div>
          </div>
        ) : null}
        {verticalTrack.scrollable ? (
          <div
            class={['virtual-scroll', styles.vertical]}
            use:ref={ref(vertical)}
            on:mousedown={handleMoveTop}
          >
            <div
              class={['virtual-scroll-ghost-thumb', styles.ghostThumb]}
              style={{
                width: '100%',
                height: `${verticalTrack.thumb}px`,
                transform: `translate(0px, ${verticalTrack.offset}px)`,
              }}
              bool:data-selected={state.selected === 'vertical'}
              on:mousedown={onScrollTopStart}
            >
              <div class={styles.verticalThumb}></div>
            </div>
          </div>
        ) : null}
      </>
    );
  };
};

export default VirtualScroll;
