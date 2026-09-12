import { createRef, FC, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { sceneScrollToAction } from '@/engine/modules/settings/atom.actions';
import { getSceneTransform } from '@/konva/scene/viewport';

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
  const sourceRef = useSceneSource(ctx);
  const horizontal = createRef<HTMLDivElement>();
  const vertical = createRef<HTMLDivElement>();

  const handleMoveLeft = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canMove = !el.closest('.virtual-scroll-ghost-thumb');
    if (!canMove) return;

    const { store } = app.value;
    const { viewport } = store.state.editor;
    const source = sourceRef.value;
    const { originY } = getSceneTransform(store.state, source);
    const track = getHorizontalTrack();
    const rect = horizontal.value.getBoundingClientRect();

    store.dispatch(
      sceneScrollToAction(source, {
        originX: trackPointToScroll(
          track,
          event.clientX - rect.x,
          viewport.width
        ),
        originY,
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
    const { viewport } = store.state.editor;
    const source = sourceRef.value;
    const { originX } = getSceneTransform(store.state, source);
    const track = getVerticalTrack();
    const rect = vertical.value.getBoundingClientRect();

    store.dispatch(
      sceneScrollToAction(source, {
        originX,
        originY: trackPointToScroll(
          track,
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
