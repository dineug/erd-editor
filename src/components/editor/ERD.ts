import './Canvas';

import { Menu } from '@@types/core/contextmenu';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  watch,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { useContext } from '@/core/hooks/context.hook';
import { movementCanvas } from '@/engine/command/canvas.cmd.helper';
import { createERDMenus } from '@/core/contextmenu/erd.contextmenu';
import { createShowMenus } from '@/core/contextmenu/show.contextmenu';
import { createDatabaseMenus } from '@/core/contextmenu/database.contextmenu';
import { selectEndMemo } from '@/engine/command/memo.cmd.helper';
import { selectEndTable } from '@/engine/command/table.cmd.helper';
import { useDestroy } from '@/core/hooks/destroy.hook';
import { EditorStyle } from './index.style';

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
}

const ERD: FunctionalComponent<ERDProps, ERDElement> = (props, ctx) => {
  const state = observable<ERDState>({
    contextmenuX: 0,
    contextmenuY: 0,
    menus: null,
  });
  const contextRef = useContext(ctx);
  const destroy = useDestroy();

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    state.contextmenuX = event.clientX;
    state.contextmenuY = event.clientY;
    state.menus = createERDMenus(contextRef.value);
  };

  const onCloseContextmenu = () => (state.menus = null);

  const onMove = ({ event, movementX, movementY }: Move) => {
    const { store } = contextRef.value;
    event.type === 'mousemove' && event.preventDefault();
    store.dispatch(movementCanvas(movementX, movementY));
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    onCloseContextmenu();

    if (!el.closest('.vuerd-table') && !el.closest('.vuerd-memo')) {
      const { store } = contextRef.value;
      const { drag$ } = contextRef.value.globalEvent;
      store.dispatch(selectEndTable(), selectEndMemo());
      drag$.subscribe(onMove);
    }
  };

  beforeMount(() => {
    const { canvasState } = contextRef.value.store;

    destroy.push(
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
      })
    );
  });

  return () => html`
    <div
      class="vuerd-erd"
      style=${styleMap({
        width: `${props.width}px`,
        height: `${props.height}px`,
      })}
      @mousedown=${onMousedown}
      @contextmenu=${onContextmenu}
    >
      <div class="vuerd-erd-background"></div>
      <vuerd-canvas></vuerd-canvas>
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
  style: EditorStyle,
  render: ERD,
});
