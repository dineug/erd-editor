import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';

import { getViewport } from '@/core/helper/dragSelect.helper';
import { useContext } from '@/core/hooks/context.hook';
import { SIZE_MINIMAP_MARGIN, SIZE_MINIMAP_WIDTH } from '@/core/layout';

import { useMinimapScroll } from './useMinimapScroll';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-minimap-handle': MinimapHandleElement;
  }
}

export interface MinimapHandleProps {
  selected: boolean;
}

export interface MinimapHandleElement extends MinimapHandleProps, HTMLElement {}

const MinimapHandle: FunctionalComponent<
  MinimapHandleProps,
  MinimapHandleElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { state, onScrollStart } = useMinimapScroll(ctx);

  const getRatio = () => {
    const { width } = contextRef.value.store.canvasState;
    return SIZE_MINIMAP_WIDTH / width;
  };

  const getStyleMap = () => {
    const { store } = contextRef.value;
    const { scrollLeft, scrollTop } = store.canvasState;
    const ratio = getRatio();
    const viewport = getViewport(store);
    const x = scrollLeft * ratio;
    const y = scrollTop * ratio;
    const left = viewport.width - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN - x;
    const top = SIZE_MINIMAP_MARGIN - y;
    const width = viewport.width * ratio;
    const height = viewport.height * ratio;

    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  return () => html`
    <div
      class="vuerd-minimap-handle"
      style=${styleMap(getStyleMap())}
      ?data-selected=${state.selected || props.selected}
      @mousedown=${onScrollStart}
      @touchstart=${onScrollStart}
    ></div>
  `;
};

defineComponent('vuerd-minimap-handle', {
  observedProps: ['selected'],
  shadow: false,
  render: MinimapHandle,
});
