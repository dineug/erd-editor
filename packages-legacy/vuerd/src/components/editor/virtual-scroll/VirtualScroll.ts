import {
  defineComponent,
  FunctionalComponent,
  html,
  query,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';

import { getViewport } from '@/core/helper/dragSelect.helper';
import { useContext } from '@/core/hooks/context.hook';
import { moveCanvas } from '@/engine/command/canvas.cmd.helper';

import { useVirtualScroll } from './useVirtualScroll';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-virtual-scroll': VirtualScrollElement;
  }
}

export interface VirtualScrollProps {}

export interface VirtualScrollElement extends VirtualScrollProps, HTMLElement {}

const VirtualScroll: FunctionalComponent<
  VirtualScrollProps,
  VirtualScrollElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const {
    state,
    getWidthRatio,
    getHeightRatio,
    onScrollLeftStart,
    onScrollTopStart,
  } = useVirtualScroll(ctx);
  const horizontal = query<HTMLElement>('.vuerd-erd-virtual-scroll-horizontal');
  const vertical = query<HTMLElement>('.vuerd-erd-virtual-scroll-vertical');

  const handleMoveLeft = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canMove = !el.closest('.virtual-scroll-ghost-thumb');
    if (!canMove) return;

    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const ratio = getWidthRatio();
    const $horizontal = horizontal.value;
    const rect = $horizontal.getBoundingClientRect();
    const clientX = event.clientX;

    const x = clientX - rect.x;
    const absoluteX = x / ratio;
    const scrollLeft = absoluteX - viewport.width / 2;

    store.dispatch(moveCanvas(store.canvasState.scrollTop, -1 * scrollLeft));

    onScrollLeftStart(event);
  };

  const handleMoveTop = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canMove = !el.closest('.virtual-scroll-ghost-thumb');
    if (!canMove) return;

    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const ratio = getHeightRatio();
    const $vertical = vertical.value;
    const rect = $vertical.getBoundingClientRect();
    const clientY = event.clientY;

    const y = clientY - rect.y;
    const absoluteY = y / ratio;
    const scrollTop = absoluteY - viewport.height / 2;

    store.dispatch(moveCanvas(-1 * scrollTop, store.canvasState.scrollLeft));

    onScrollTopStart(event);
  };

  return () => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const { width, height, scrollLeft, scrollTop } = store.canvasState;

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
              class="virtual-scroll vuerd-erd-virtual-scroll-horizontal"
              @mousedown=${handleMoveLeft}
            >
              <div
                class="virtual-scroll-ghost-thumb ghostThumb"
                style=${styleMap({
                  width: `${w}px`,
                  height: '100%',
                  transform: `translate(${left}px, 0px)`,
                })}
                ?data-selected=${state.selected === 'horizontal'}
                @mousedown=${onScrollLeftStart}
              >
                <div class="horizontalThumb"></div>
              </div>
            </div>
          `
        : null}
      ${showVertical
        ? html`
            <div
              class="virtual-scroll vuerd-erd-virtual-scroll-vertical"
              @mousedown=${handleMoveTop}
            >
              <div
                class="virtual-scroll-ghost-thumb ghostThumb"
                style=${styleMap({
                  width: '100%',
                  height: `${h}px`,
                  transform: `translate(0px, ${top}px)`,
                })}
                ?data-selected=${state.selected === 'vertical'}
                @mousedown=${onScrollTopStart}
              >
                <div class="verticalThumb"></div>
              </div>
            </div>
          `
        : null}
    `;
  };
};

defineComponent('vuerd-virtual-scroll', {
  shadow: false,
  render: VirtualScroll,
});
