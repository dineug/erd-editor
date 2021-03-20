import { ERDEditorContext } from '@@types/index';
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
import { createDDL } from '@/core/sql/ddl';
import { hljs, highlightThemeMap } from '@/core/highlight';
import { createSQLDDLMenus } from '@/core/contextmenu/sql-ddl.contextmenu';
import { crateHighlightTheme } from '@/core/contextmenu/highlightTheme.contextmenu';
import { createDatabaseMenus } from '@/core/contextmenu/database.contextmenu';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { SQLDDLStyle } from './SQLDDL.style';
import { Scrollbar } from '@/components/css/scrollbar.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-sql-ddl': SQLDDLElement;
  }
}

export interface SQLDDLProps {}

export interface SQLDDLElement extends SQLDDLProps, HTMLElement {
  api: ERDEditorContext;
}

interface SQLDDLState {
  contextmenuX: number;
  contextmenuY: number;
  menus: Menu[] | null;
}

const SQLDDL: FunctionalComponent<SQLDDLProps, SQLDDLElement> = (
  props,
  ctx
) => {
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
    state.menus = createSQLDDLMenus(ctx.api);
  };

  const onCloseContextmenu = () => (state.menus = null);

  const onMousedown = () => onCloseContextmenu();

  beforeMount(() => {
    const { canvasState } = ctx.api.store;

    unmountedGroup.push(
      watch(canvasState, propName => {
        if (propName !== 'database') return;
        const menue = state.menus?.find(menu => menu.name === 'Database');
        if (!menue) return;

        menue.children = createDatabaseMenus(ctx.api);
      }),
      watch(canvasState, propName => {
        if (propName !== 'highlightTheme') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Highlight Theme'
        );
        if (!menue) return;

        menue.children = crateHighlightTheme(ctx.api);
      })
    );
  });

  return () => {
    const {
      canvasState: { highlightTheme },
    } = ctx.api.store;
    const sql = createDDL(ctx.api.store);
    const sqlHTML = hljs.highlight('sql', sql).value;

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
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: [SQLDDLStyle, Scrollbar].join(''),
  render: SQLDDL,
});
