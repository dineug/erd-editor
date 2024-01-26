import {
  defineComponent,
  FunctionalComponent,
  observable,
  svg,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';

import { useContext } from '@/core/hooks/context.hook';
import { SIZE_TABLE_BORDER, SIZE_TABLE_PADDING } from '@/core/layout';
import {
  activeColumn,
  activeEndColumn,
} from '@/engine/command/column.cmd.helper';
import { Relationship } from '@@types/engine/store/relationship.state';

import { relationshipTpl } from './Relationship.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-canvas-svg': CanvasSVGElement;
  }
}

export interface CanvasSVGProps {}

export interface CanvasSVGElement extends CanvasSVGProps, HTMLElement {}

const SIZE_GRID = 100;
const MARGIN = 5;
const TABLE_PADDING = (SIZE_TABLE_PADDING + SIZE_TABLE_BORDER) * 2;
const TABLE_MARGIN = MARGIN * 2 + TABLE_PADDING;

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

  const getRatio = () => {
    const {
      store: {
        canvasState: { width },
      },
    } = contextRef.value;
    return SIZE_GRID / width;
  };

  return () => {
    const {
      store: {
        canvasState: { width, height },
        relationshipState: { relationships },
      },
    } = contextRef.value;
    const ratio = getRatio();

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
              ${relationshipTpl(relationship, 3)}
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
