import { DrawRelationship as IDrawRelationship } from '@@types/engine/store/editor.state';
import {
  defineComponent,
  svg,
  FunctionalComponent,
  beforeMount,
  closestElement,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { fromEvent } from 'rxjs';
import { getDraw } from '@/engine/store/helper/relationship.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { drawRelationship } from '@/engine/command/editor.cmd.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-draw-relationship': Element;
  }
}

export interface Props {
  draw: IDrawRelationship;
}

export interface Element extends Props, HTMLElement {}

const DrawRelationship: FunctionalComponent<Props, Element> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();

  beforeMount(() => {
    const { store } = contextRef.value;
    const erd = closestElement('.vuerd-erd', ctx);
    if (!erd) return;

    unmountedGroup.push(
      fromEvent<MouseEvent>(erd, 'mousemove').subscribe(event => {
        event.preventDefault();
        const { x, y } = erd.getBoundingClientRect();

        store.dispatch(drawRelationship(event.clientX - x, event.clientY - y));
      })
    );
  });

  return () => {
    const {
      store: { canvasState },
    } = contextRef.value;

    const { path, line } = getDraw(props.draw);

    return svg`
       <svg
        class="vuerd-draw-relationship"
        style=${styleMap({
          width: `${canvasState.width}px`,
          height: `${canvasState.height}px`,
        })}
      >
        <g>
          <path
            d=${path.path.d()}
            stroke-dasharray="10"
            stroke-width="3"
            fill="transparent"
          ></path>
          <line
            x1=${path.line.start.x1} y1=${path.line.start.y1}
            x2=${path.line.start.x2} y2=${path.line.start.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.base.x1} y1=${line.start.base.y1}
            x2=${line.start.base.x2} y2=${line.start.base.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.base2.x1} y1=${line.start.base2.y1}
            x2=${line.start.base2.x2} y2=${line.start.base2.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.center2.x1} y1=${line.start.center2.y1}
            x2=${line.start.center2.x2} y2=${line.start.center2.y2}
            stroke-width="3"
          ></line>
        </g>
      </svg>
  `;
  };
};

defineComponent('vuerd-draw-relationship', {
  observedProps: ['draw'],
  shadow: false,
  render: DrawRelationship,
});
