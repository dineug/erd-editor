import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_MINIMAP_WIDTH, SIZE_MINIMAP_MARGIN } from '@/core/layout';
import { useContext } from '@/core/hooks/context.hook';
import { movementCanvas } from '@/engine/command/canvas.cmd.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-minimap-handle': MinimapHandleElement;
  }
}

export interface MinimapHandleProps {
  width: number;
  height: number;
}

export interface MinimapHandleElement extends MinimapHandleProps, HTMLElement {}

const MinimapHandle: FunctionalComponent<
  MinimapHandleProps,
  MinimapHandleElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);

  const getRatio = () => {
    const { width } = contextRef.value.store.canvasState;
    return SIZE_MINIMAP_WIDTH / width;
  };

  const getStyleMap = () => {
    const { scrollLeft, scrollTop } = contextRef.value.store.canvasState;
    const ratio = getRatio();
    const x = scrollLeft * ratio;
    const y = scrollTop * ratio;
    const left = props.width - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN - x;
    const top = SIZE_MINIMAP_MARGIN - y;
    return {
      width: `${props.width * ratio}px`,
      height: `${props.height * ratio}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const onMove = ({ event, movementX, movementY }: Move) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = contextRef.value;
    const ratio = getRatio();

    store.dispatch(
      movementCanvas((movementX / ratio) * -1, (movementY / ratio) * -1)
    );
  };

  const onMoveStart = () => {
    const {
      globalEvent: { drag$ },
    } = contextRef.value;

    drag$.subscribe(onMove);
  };

  return () => html`
    <div
      class="vuerd-minimap-handle"
      style=${styleMap(getStyleMap())}
      @mousedown=${onMoveStart}
      @touchstart=${onMoveStart}
    ></div>
  `;
};

defineComponent('vuerd-minimap-handle', {
  observedProps: ['width', 'height'],
  shadow: false,
  render: MinimapHandle,
});
