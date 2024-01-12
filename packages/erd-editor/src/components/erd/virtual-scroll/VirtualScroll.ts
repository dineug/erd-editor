import { createRef, FC, html, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';

import { useVirtualScroll } from './useVirtualScroll';
import * as styles from './VirtualScroll.styles';

export type VirtualScrollProps = {};

const VirtualScroll: FC<VirtualScrollProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const {
    state,
    getWidthRatio,
    getHeightRatio,
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
    const ratio = getWidthRatio();
    const $horizontal = horizontal.value;
    const rect = $horizontal.getBoundingClientRect();
    const clientX = event.clientX;

    const x = clientX - rect.x;
    const absoluteX = x / ratio;
    const scrollLeft = absoluteX - viewport.width / 2;

    store.dispatch(
      scrollToAction({
        scrollLeft: -1 * scrollLeft,
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
    } = store.state;
    const ratio = getHeightRatio();
    const $vertical = vertical.value;
    const rect = $vertical.getBoundingClientRect();
    const clientY = event.clientY;

    const y = clientY - rect.y;
    const absoluteY = y / ratio;
    const scrollTop = absoluteY - viewport.height / 2;

    store.dispatch(
      scrollToAction({
        scrollLeft: store.state.settings.scrollLeft,
        scrollTop: -1 * scrollTop,
      })
    );

    onScrollTopStart(event);
  };

  return () => {
    const { store } = app.value;
    const {
      editor: { viewport },
      settings: { width, height, scrollLeft, scrollTop },
    } = store.state;

    const wRatio = getWidthRatio();
    const hRatio = getHeightRatio();
    const w = viewport.width * wRatio;
    const h = viewport.height * hRatio;
    const left = -1 * scrollLeft * wRatio;
    const top = -1 * scrollTop * hRatio;

    const showHorizontal = viewport.width < width;
    const showVertical = viewport.height < height;

    return html`
      ${showHorizontal
        ? html`
            <div
              class=${['virtual-scroll', styles.horizontal]}
              ${ref(horizontal)}
              @mousedown=${handleMoveLeft}
            >
              <div
                class=${['virtual-scroll-ghost-thumb', styles.ghostThumb]}
                style=${{
                  width: `${w}px`,
                  height: '100%',
                  transform: `translate(${left}px, 0px)`,
                }}
                ?data-selected=${state.selected === 'horizontal'}
                @mousedown=${onScrollLeftStart}
              >
                <div class=${styles.horizontalThumb}></div>
              </div>
            </div>
          `
        : null}
      ${showVertical
        ? html`
            <div
              class=${['virtual-scroll', styles.vertical]}
              ${ref(vertical)}
              @mousedown=${handleMoveTop}
            >
              <div
                class=${['virtual-scroll-ghost-thumb', styles.ghostThumb]}
                style=${{
                  width: '100%',
                  height: `${h}px`,
                  transform: `translate(0px, ${top}px)`,
                }}
                ?data-selected=${state.selected === 'vertical'}
                @mousedown=${onScrollTopStart}
              >
                <div class=${styles.verticalThumb}></div>
              </div>
            </div>
          `
        : null}
    `;
  };
};

export default VirtualScroll;
