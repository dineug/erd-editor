import { Table } from '@@types/engine/store/table.state';
import { Menu } from '@@types/core/contextmenu';
import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  watch,
} from '@dineug/lit-observable';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { createDDL, createDDLTable } from '@/core/sql/ddl';
import { hljs, highlightThemeMap } from '@/core/highlight';
import { createSQLDDLMenus } from '@/core/contextmenu/sql-ddl.menu';
import { createHighlightThemeMenus } from '@/core/contextmenu/highlightTheme.menu';
import { createDatabaseMenus } from '@/core/contextmenu/database.menu';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useContext } from '@/core/hooks/context.hook';
import { SQLDDLStyle } from './SQLDDL.style';
import { ScrollbarStyle } from '@/components/css/scrollbar.style';
import { Bus } from '@/core/helper/eventBus.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-sql-ddl': SQLDDLElement;
  }
}

export interface SQLDDLProps {
  table: Table | null;
  mode: 'all' | 'table';
}

export interface SQLDDLElement extends SQLDDLProps, HTMLElement {}

interface SQLDDLState {
  contextmenuX: number;
  contextmenuY: number;
  menus: Menu[] | null;
}

const SQLDDL: FunctionalComponent<SQLDDLProps, SQLDDLElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable<SQLDDLState>({
    menus: null,
    contextmenuX: 0,
    contextmenuY: 0,
  });
  const { unmountedGroup } = useUnmounted();

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    state.contextmenuX = event.clientX;
    state.contextmenuY = event.clientY;
    state.menus = createSQLDDLMenus(contextRef.value);
  };

  const onCloseContextmenu = () => (state.menus = null);

  const onMousedown = () => onCloseContextmenu();

  beforeMount(() => {
    const context = contextRef.value;
    const {
      store: { canvasState },
      eventBus,
    } = context;

    unmountedGroup.push(
      watch(canvasState, propName => {
        if (propName !== 'database') return;
        const menue = state.menus?.find(menu => menu.name === 'Database');
        if (!menue) return;

        menue.children = createDatabaseMenus(context);
      }),
      watch(canvasState, propName => {
        if (propName !== 'highlightTheme') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Highlight Theme'
        );
        if (!menue) return;

        menue.children = createHighlightThemeMenus(context);
      }),
      eventBus.on(Bus.Contextmenu.close).subscribe(onCloseContextmenu)
    );
  });

  return () => {
    const { store } = contextRef.value;
    const {
      canvasState: { highlightTheme },
    } = store;
    const sql =
      props.mode === 'all' || !props.table
        ? createDDL(store)
        : createDDLTable(store, props.table);
    const sqlHTML = hljs.highlight(sql, {
      language: 'sql',
    }).value;

    return html`
      <style type="text/css">
        ${highlightThemeMap[highlightTheme]}
      </style>
      <div
        class="vuerd-sql-ddl vuerd-scrollbar hljs"
        contenteditable="true"
        spellcheck="false"
        @mousedown=${onMousedown}
        @contextmenu=${onContextmenu}
      >
        ${unsafeHTML(sqlHTML)}
        ${state.menus
          ? html`
              <vuerd-contextmenu
                .menus=${state.menus}
                .x=${state.contextmenuX}
                .y=${state.contextmenuY}
                @close-contextmenu=${onCloseContextmenu}
              >
              </vuerd-contextmenu>
            `
          : null}
      </div>
    `;
  };
};

defineComponent('vuerd-sql-ddl', {
  observedProps: [
    {
      name: 'table',
      default: null,
    },
    {
      name: 'mode',
      default: 'all',
    },
  ],
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: [SQLDDLStyle, ScrollbarStyle].join(''),
  render: SQLDDL,
});
