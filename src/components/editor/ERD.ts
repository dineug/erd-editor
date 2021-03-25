import './Canvas';
import './DragSelect';
import './minimap/Minimap';

import { Menu } from '@@types/core/contextmenu';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  watch,
  query,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { useContext } from '@/core/hooks/context.hook';
import {
  movementCanvas,
  movementZoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { createERDMenus } from '@/core/contextmenu/erd.menu';
import { createShowMenus } from '@/core/contextmenu/show.menu';
import { createDatabaseMenus } from '@/core/contextmenu/database.menu';
import { selectEndMemo } from '@/engine/command/memo.cmd.helper';
import { selectEndTable$ } from '@/engine/command/table.cmd.helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useERDKeymap } from '@/core/hooks/ERDKeymap.hook';
import { useMousePosition } from '@/core/hooks/mousePosition.hook';
import { getBase64Icon } from '@/core/icon';
import { IndexStyle } from './index.style';
import { Contextmenu } from '@/core/helper/event.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-erd': ERDElement;
  }
}

export interface ERDProps {
  width: number;
  height: number;
}

export interface ERDElement extends ERDProps, HTMLElement {}

interface ERDState {
  contextmenuX: number;
  contextmenuY: number;
  menus: Menu[] | null;
  dragSelect: boolean;
  dragSelectX: number;
  dragSelectY: number;
}

const ERD: FunctionalComponent<ERDProps, ERDElement> = (props, ctx) => {
  const state = observable<ERDState>({
    contextmenuX: 0,
    contextmenuY: 0,
    menus: null,
    dragSelect: false,
    dragSelectX: 0,
    dragSelectY: 0,
  });
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const { getPosition } = useMousePosition('.vuerd-erd');
  const canvasRef = query('.vuerd-canvas');
  useERDKeymap(ctx);

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    state.contextmenuX = event.clientX;
    state.contextmenuY = event.clientY;
    state.menus = createERDMenus(contextRef.value, canvasRef.value);
  };

  const onCloseContextmenu = () => (state.menus = null);

  const onMove = ({ event, movementX, movementY }: Move) => {
    const { store } = contextRef.value;
    event.type === 'mousemove' && event.preventDefault();
    store.dispatch(movementCanvas(movementX, movementY));
  };

  const onDragSelect = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;
    onCloseContextmenu();

    if (
      !el.closest('.vuerd-table') &&
      !el.closest('.vuerd-memo') &&
      !el.closest('.vuerd-input')
    ) {
      const {
        store,
        globalEvent: { drag$ },
      } = contextRef.value;

      store.dispatch(selectEndTable$(), selectEndMemo());

      if (event.type === 'mousedown' && (event.ctrlKey || event.metaKey)) {
        const position = getPosition(event as MouseEvent);
        state.dragSelect = true;
        state.dragSelectX = position.x;
        state.dragSelectY = position.y;
      } else {
        drag$.subscribe(onMove);
      }
    }
  };

  const onWheel = (event: WheelEvent) => {
    const { store } = contextRef.value;
    store.dispatch(movementZoomCanvas(event.deltaY < 0 ? 0.1 : -0.1));
  };

  const onDragSelectEnd = () => (state.dragSelect = false);

  beforeMount(() => {
    const {
      store: { canvasState },
      eventBus,
    } = contextRef.value;

    unmountedGroup.push(
      watch(canvasState.show, () => {
        const menue = state.menus?.find(menu => menu.name === 'View Option');
        if (!menue) return;

        menue.children = createShowMenus(contextRef.value);
      }),
      watch(canvasState, propName => {
        if (propName !== 'database') return;
        const menue = state.menus?.find(menu => menu.name === 'Database');
        if (!menue) return;

        menue.children = createDatabaseMenus(contextRef.value);
      }),
      eventBus.on(Contextmenu.close).subscribe(onCloseContextmenu)
    );
  });

  return () => {
    const {
      store: {
        editorState: { drawRelationship },
      },
    } = contextRef.value;

    return html`
      <div
        class="vuerd-erd"
        style=${styleMap({
          width: `${props.width}px`,
          height: `${props.height}px`,
          cursor: drawRelationship
            ? `url("${getBase64Icon(
                drawRelationship.relationshipType
              )}") 16 16, auto`
            : '',
        })}
        @mousedown=${onDragSelect}
        @touchstart=${onDragSelect}
        @contextmenu=${onContextmenu}
        @wheel=${onWheel}
      >
        <div class="vuerd-erd-background"></div>
        <vuerd-canvas></vuerd-canvas>
        <vuerd-minimap
          .width=${props.width}
          .height=${props.height}
        ></vuerd-minimap>
        ${state.dragSelect
          ? html`
              <vuerd-drag-select
                .x=${state.dragSelectX}
                .y=${state.dragSelectY}
                @drag-select-end=${onDragSelectEnd}
              ></vuerd-drag-select>
            `
          : null}
        ${state.menus
          ? html`
              <vuerd-contextmenu
                .menus=${state.menus}
                .x=${state.contextmenuX}
                .y=${state.contextmenuY}
                @close-contextmenu=${onCloseContextmenu}
              ></vuerd-contextmenu>
            `
          : null}
      </div>
    `;
  };
};

defineComponent('vuerd-erd', {
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
    height: '100%',
  },
  style: IndexStyle,
  render: ERD,
});
