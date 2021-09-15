import { html } from '@vuerd/lit-observable';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3';

import { createBalanceRange, noop } from '@/core/helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { SIZE_CANVAS_ZOOM_MIN } from '@/core/layout';
import { readonlyEditor$ } from '@/engine/command/editor.cmd.helper.gen';
import { relationshipSort } from '@/engine/store/helper/relationship.helper';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { IStore } from '@/internal-types/store';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Table } from '@@types/engine/store/table.state';

interface Node {
  id: string;
  r: number;
  x: number;
  y: number;
  ref: Table;
}

interface Link {
  source: string;
  target: string;
}

const zoomBalanceRange = createBalanceRange(SIZE_CANVAS_ZOOM_MIN, 0.7);

function isLink(
  links: Link[],
  startTableId: string,
  endTableId: string
): boolean {
  let result = true;
  for (const link of links) {
    if (link.source === startTableId && link.target === endTableId) {
      result = false;
      break;
    }
  }
  return result;
}

function createNodes(
  tables: Table[],
  relationships: Relationship[],
  x: number,
  y: number
): [Array<Node>, Array<Link>] {
  const nodes: Node[] = [];
  const links: Link[] = [];

  tables.forEach(table => {
    nodes.push({
      id: table.id,
      r: (table.width() + table.height()) / 4,
      x,
      y,
      ref: table,
    });
  });

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    if (
      start.tableId !== end.tableId &&
      isLink(links, start.tableId, end.tableId)
    ) {
      links.push({
        source: start.tableId,
        target: end.tableId,
      });
    }
  });

  return [nodes, links];
}

function holdEditor(store: IStore) {
  const { canvasState, editorState } = store;
  const prevState = {
    zoomLevel: canvasState.zoomLevel,
    scrollLeft: canvasState.scrollLeft,
    scrollTop: canvasState.scrollTop,
  };

  canvasState.zoomLevel = zoomBalanceRange(
    editorState.viewport.width / canvasState.width
  );
  canvasState.scrollLeft =
    (canvasState.width / 2 - editorState.viewport.width / 2) * -1;
  canvasState.scrollTop =
    (canvasState.height / 2 - editorState.viewport.height / 2) * -1;
  // TODO: command
  editorState.erdUiEventNone = true;
  store.dispatchSync(readonlyEditor$(true));

  return prevState;
}

function releaseEditor(
  { eventBus, store }: IERDEditorContext,
  prevState: ReturnType<typeof holdEditor>
) {
  const { editorState, canvasState } = store;
  eventBus.emit(Bus.BalanceRange.move);
  store.dispatchSync(readonlyEditor$(false));
  editorState.erdUiEventNone = false;
  canvasState.zoomLevel = prevState.zoomLevel;
  // canvasState.scrollLeft = prevState.scrollLeft;
  // canvasState.scrollTop = prevState.scrollTop;
  eventBus.emit(Bus.Editor.change);
}

export function runAutomaticTablePlacement(context: IERDEditorContext) {
  const { eventBus, store } = context;
  const {
    tableState: { tables },
    relationshipState: { relationships },
    canvasState,
  } = store;
  const centerX = canvasState.width / 2;
  const centerY = canvasState.height / 2;

  if (!tables.length) {
    eventBus.emit(Bus.ToastBar.add, {
      bodyTpl: html`Not found tables`,
    });
    return;
  }

  let resolveToastBar = noop;
  let rejectToastBar = noop;

  const close = new Promise<void>((resolve, reject) => {
    resolveToastBar = resolve;
    rejectToastBar = reject;
  });

  try {
    const [nodes, links] = createNodes(tables, relationships, centerX, centerY);
    const prevState = holdEditor(store);
    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink(links).id((d: any) => d.id)
      )
      .force(
        'collide',
        forceCollide().radius((d: any) => 100 + d.r)
      )
      .force('charge', forceManyBody())
      .force('x', forceX(centerX))
      .force('y', forceY(centerY))
      .on('tick', () => {
        nodes.forEach(({ r, x, y, ref }) => {
          ref.ui.top = y - r;
          ref.ui.left = x - r;
        });
        relationshipSort(tables, relationships);
      });

    const onStop = () => {
      simulation.stop();
      releaseEditor(context, prevState);
      resolveToastBar();
    };

    eventBus.emit(Bus.ToastBar.add, {
      bodyTpl: html`
        <span>Automatic Table Placement...</span>
        <div class="vuerd-btn" @click=${onStop}>Stop</div>
      `,
      close,
    });

    simulation.on('end', onStop);
  } catch (e) {
    rejectToastBar();
  }
}
