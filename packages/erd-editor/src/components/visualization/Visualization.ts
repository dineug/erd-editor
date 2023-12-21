import { query } from '@dineug/erd-editor-schema';
import { FC, html, observable, onBeforeMount, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Table from '@/components/visualization/table/Table';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Table as TableType } from '@/internal-types';

import { createVisualization } from './createVisualization';
import * as styles from './Visualization.styles';

const HEIGHT = 1200;
const MARGIN = 20;

export type VisualizationProps = {};

type VisualizationState = {
  preview: boolean;
  drag: boolean;
  table?: TableType | null;
  columnId: string | null;
  x: number;
  y: number;
};

const Visualization: FC<VisualizationProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable<VisualizationState>({
    preview: false,
    drag: false,
    table: null,
    columnId: null,
    x: 0,
    y: 0,
  });

  let d3SVG: ReturnType<typeof createVisualization> | null = null;

  const setViewBox = () => {
    const { store } = app.value;
    const {
      editor: { viewport },
    } = store.state;

    d3SVG?.attr('viewBox', [
      -viewport.width / 2,
      -HEIGHT / 2,
      viewport.width,
      HEIGHT,
    ]);
  };

  onBeforeMount(() => {
    const { store } = app.value;
    const { editor } = store.state;

    d3SVG = createVisualization(store.state, {
      onDragStart: () => {
        state.drag = true;
      },
      onDragEnd: () => {
        state.drag = false;
      },
      onStartPreview: (
        event: MouseEvent,
        tableId: string | null,
        columnId: string | null
      ) => {
        if (!tableId) return;

        const { store } = app.value;
        const { collections } = store.state;
        const table = query(collections)
          .collection('tableEntities')
          .selectById(tableId);
        if (!table) return;

        state.columnId = columnId;
        state.table = table;
        state.x = event.clientX;
        state.y = event.clientY;
        state.preview = true;
      },
      onEndPreview: () => {
        state.preview = false;
      },
    });

    setViewBox();

    addUnsubscribe(
      watch(editor.viewport).subscribe(propName => {
        if (propName !== 'width') return;
        setViewBox();
      }),
      () => {
        d3SVG?.remove();
        d3SVG = null;
      }
    );
  });

  return () => {
    const showPreview = state.table && !state.drag && state.preview;

    return html`
      <div class=${['scrollbar', styles.root]}>
        ${d3SVG?.node()}
        ${showPreview
          ? html`
              <${Table}
                table=${state.table}
                columnId=${state.columnId}
                x=${state.x + MARGIN}
                y=${state.y}
              />
            `
          : null}
      </div>
    `;
  };
};

export default Visualization;
