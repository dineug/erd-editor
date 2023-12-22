import {
  defineComponent,
  FunctionalComponent,
  observable,
  svg,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';
import * as PF from 'pathfinding';

import { createBalanceRange } from '@/core/helper';
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
  const gridCache = new Map<string, PF.Grid>();

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

  const range = createBalanceRange(0, SIZE_GRID);

  const getRatio = () => {
    const {
      store: {
        canvasState: { width },
      },
    } = contextRef.value;
    return SIZE_GRID / width;
  };

  const getGrid = (): PF.Grid => {
    const {
      store: {
        canvasState: { width, height },
      },
    } = contextRef.value;
    const key = `${width}:${height}`;

    return gridCache.has(key)
      ? (gridCache.get(key) as PF.Grid)
      : (gridCache
          .set(key, new PF.Grid(SIZE_GRID, SIZE_GRID))
          .get(key) as PF.Grid);
  };

  const createGrid = () => {
    const {
      store: {
        tableState: { tables },
      },
    } = contextRef.value;
    const ratio = getRatio();
    const grid = getGrid().clone();

    tables.forEach(table => {
      const x = Math.round((table.ui.left - MARGIN) * ratio);
      const y = Math.round((table.ui.top - MARGIN) * ratio);
      const maxWidth = range(
        x + Math.round((table.width() + TABLE_MARGIN) * ratio)
      );
      const maxHeight = range(
        y + Math.round((table.height() + TABLE_MARGIN) * ratio)
      );

      try {
        for (let i = range(x); i < maxWidth; i++) {
          for (let j = range(y); j < maxHeight; j++) {
            grid.setWalkableAt(i, j, false);
          }
        }
      } catch (e) {}
    });

    return grid;
  };

  return () => {
    const {
      store: {
        canvasState: {
          width,
          height,
          setting: { relationshipOptimization },
        },
        relationshipState: { relationships },
      },
    } = contextRef.value;
    const ratio = getRatio();
    const grid = relationshipOptimization ? createGrid() : null;

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
          relationship.visible
            ? svg`
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
              ${relationshipTpl(relationship, 3, grid, ratio, width, height)}
            </g>
          `
            : null
      )}
    </svg>
`;
  };
};

defineComponent('vuerd-canvas-svg', {
  shadow: false,
  render: CanvasSVG,
});
