import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  watch,
} from '@vuerd/lit-observable';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';

import { ScrollbarStyle } from '@/components/css/scrollbar.style';
import { createColumnNameCaseMenus } from '@/core/contextmenu/columnNameCase.menu';
import { createGeneratorCodeMenus } from '@/core/contextmenu/generatorCode.menu';
import { createHighlightThemeMenus } from '@/core/contextmenu/highlightTheme.menu';
import { createLanguageMenus } from '@/core/contextmenu/language.menu';
import { createTableNameCaseMenus } from '@/core/contextmenu/tableNameCase.menu';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/core/generator/code';
import { Bus } from '@/core/helper/eventBus.helper';
import { highlightThemeMap, hljs, languageMap } from '@/core/highlight';
import { useContext } from '@/core/hooks/context.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { Menu } from '@@types/core/contextmenu';
import { Table } from '@@types/engine/store/table.state';

import { GeneratorCodeStyle } from './GeneratorCode.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-generator-code': GeneratorCodeElement;
  }
}

export interface GeneratorCodeProps {
  table: Table | null;
  mode: 'all' | 'table';
}

export interface GeneratorCodeElement extends GeneratorCodeProps, HTMLElement {}

interface GeneratorCodeState {
  contextmenuX: number;
  contextmenuY: number;
  menus: Menu[] | null;
}

const GeneratorCode: FunctionalComponent<
  GeneratorCodeProps,
  GeneratorCodeElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const state = observable<GeneratorCodeState>({
    menus: null,
    contextmenuX: 0,
    contextmenuY: 0,
  });
  const { unmountedGroup } = useUnmounted();

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    state.contextmenuX = event.clientX;
    state.contextmenuY = event.clientY;
    state.menus = createGeneratorCodeMenus(contextRef.value);
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
        if (propName !== 'language') return;
        const menue = state.menus?.find(menu => menu.name === 'Language');
        if (!menue) return;

        menue.children = createLanguageMenus(context);
      }),
      watch(canvasState, propName => {
        if (propName !== 'highlightTheme') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Highlight Theme'
        );
        if (!menue) return;

        menue.children = createHighlightThemeMenus(context);
      }),
      watch(canvasState, propName => {
        if (propName !== 'tableCase') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Table Name Case'
        );
        if (!menue) return;

        menue.children = createTableNameCaseMenus(context);
      }),
      watch(canvasState, propName => {
        if (propName !== 'columnCase') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Column Name Case'
        );
        if (!menue) return;

        menue.children = createColumnNameCaseMenus(context);
      }),
      eventBus.on(Bus.Contextmenu.close).subscribe(onCloseContextmenu)
    );
  });

  return () => {
    const { store } = contextRef.value;
    const {
      canvasState: { highlightTheme, language },
    } = store;
    const code =
      props.mode === 'all' || !props.table
        ? createGeneratorCode(store)
        : createGeneratorCodeTable(store, props.table);
    const codeHTML = hljs.highlight(code, {
      language: languageMap[language],
    }).value;

    return html`
      <style type="text/css">
        ${highlightThemeMap[highlightTheme]}
      </style>
      <div
        class="vuerd-generator-code vuerd-scrollbar hljs"
        contenteditable="true"
        spellcheck="false"
        @mousedown=${onMousedown}
        @contextmenu=${onContextmenu}
      >
        ${unsafeHTML(codeHTML)}
        ${state.menus
          ? html`
              <vuerd-contextmenu
                .menus=${state.menus}
                .x=${state.contextmenuX}
                .y=${state.contextmenuY}
                @close=${onCloseContextmenu}
              >
              </vuerd-contextmenu>
            `
          : null}
      </div>
    `;
  };
};

defineComponent('vuerd-generator-code', {
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
  style: [GeneratorCodeStyle, ScrollbarStyle].join(''),
  render: GeneratorCode,
});
