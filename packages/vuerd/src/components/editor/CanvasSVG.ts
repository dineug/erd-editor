import { Relationship } from '@@types/engine/store/relationship.state';
import {
  defineComponent,
  svg,
  FunctionalComponent,
  observable,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { useContext } from '@/core/hooks/context.hook';
import {
  activeColumn,
  activeEndColumn,
} from '@/engine/command/column.cmd.helper';
import { relationshipTpl } from './Relationship.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-canvas-svg': CanvasSVGElement;
  }
}

export interface CanvasSVGProps {}

export interface CanvasSVGElement extends CanvasSVGProps, HTMLElement {}

const CanvasSVG: FunctionalComponent<CanvasSVGProps, CanvasSVGElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable({ activeId: '' });

  const onMouseover = (relationship: Relationship) => {
    const { store } = contextRef.value;
    store.dispatch(activeColumn(relationship));
    state.activeId = relationship.id;
  };

  const onMouseleave = (relationship: Relationship) => {
    const { store } = contextRef.value;
    store.dispatch(activeEndColumn(relationship));
    state.activeId = '';
  };

  return () => {
    const {
      store: {
        canvasState: { width, height },
        relationshipState: { relationships },
      },
    } = contextRef.value;

    return svg`
      <svg 
        class="vuerd-canvas-svg"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
      ${repeat(
        relationships,
        relationship => relationship.id,
        relationship =>
          svg`
            <g class=${classMap({
              'vuerd-relationship': true,
              identification:
                relationship.identification &&
                state.activeId !== relationship.id,
              active: state.activeId === relationship.id,
            })}
              data-id=${relationship.id}
              @mouseover=${() => onMouseover(relationship)}
              @mouseleave=${() => onMouseleave(relationship)}
            >
              ${relationshipTpl(relationship)}
            </g>
          `
      )}
    </svg>
`;
  };
};

defineComponent('vuerd-canvas-svg', {
  shadow: false,
  render: CanvasSVG,
});
