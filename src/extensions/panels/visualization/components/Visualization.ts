import './Table';

import { Table } from '@@types/engine/store/table.state';
import { ERDEditorContext } from '@@types/index';
import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  unmounted,
  watch,
} from '@dineug/lit-observable';
import { getData } from '@/core/helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { createVisualization } from '@/extensions/panels/visualization/core/visualization';
import { IndexStyle } from './index.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-visualization': VisualizationElement;
  }
}

export interface VisualizationProps {
  width: number;
  height: number;
}

export interface VisualizationElement extends VisualizationProps, HTMLElement {
  api: ERDEditorContext;
}

interface VisualizationState {
  preview: boolean;
  drag: boolean;
  table?: Table | null;
  columnId: string | null;
  top: number;
  left: number;
}

const HEIGHT = 1200;
const MARGIN = 20;

const Visualization: FunctionalComponent<
  VisualizationProps,
  VisualizationElement
> = (props, ctx) => {
  const state = observable<VisualizationState>({
    preview: false,
    drag: false,
    table: null,
    columnId: null,
    top: 0,
    left: 0,
  });
  let d3SVG: any = null;
  const { unmountedGroup } = useUnmounted();

  const dragStart = () => {
    state.drag = true;
  };

  const dragEnd = () => {
    state.drag = false;
  };

  const startPreview = (tableId: string, columnId: string) => {
    const { tables } = ctx.api.store.tableState;
    state.preview = true;
    state.table = getData(tables, tableId);
    state.columnId = columnId;
  };

  const endPreview = () => {
    state.preview = false;
  };

  const setViewBox = () => {
    d3SVG?.attr('viewBox', [
      -props.width / 2,
      -HEIGHT / 2,
      props.width,
      HEIGHT,
    ]);
  };

  const onMousemove = (event: MouseEvent) => {
    state.top = event.clientY;
    state.left = event.clientX;
  };

  beforeMount(() => {
    d3SVG = createVisualization(ctx.api.store, {
      dragStart,
      dragEnd,
      startPreview,
      endPreview,
    });

    setViewBox();

    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'width') return;

        setViewBox();
      })
    );
  });

  unmounted(() => {
    d3SVG?.remove();
    d3SVG = null;
  });

  return () => html`
    <div class="vuerd-visualization vuerd-scrollbar" @mousemove=${onMousemove}>
      ${d3SVG.node()}
      ${state.table && !state.drag && state.preview
        ? html`
            <vuerd-visualization-table
              .table=${state.table}
              .columnId=${state.columnId}
              .top=${state.top}
              .left=${state.left + MARGIN}
            ></vuerd-visualization-table>
          `
        : null}
    </div>
  `;
};

defineComponent('vuerd-visualization', {
  observedProps: [
    {
      name: 'width',
      default: 0,
    },
    {
      name: 'height',
      default: 0,
    },
  ],
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: IndexStyle,
  render: Visualization,
});
