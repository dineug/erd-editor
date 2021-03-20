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
import { createGeneratorCode } from '@/core/generator/code';
import { hljs, highlightThemeMap, languageMap } from '@/core/highlight';
import { createGeneratorCodeMenus } from '@/core/contextmenu/generatorCode.menu';
import { createHighlightThemeMenus } from '@/core/contextmenu/highlightTheme.menu';
import { createTableNameCaseMenus } from '@/core/contextmenu/tableNameCase.menu';
import { createColumnNameCaseMenus } from '@/core/contextmenu/columnNameCase.menu';
import { createLanguageMenus } from '@/core/contextmenu/language.menu';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { GeneratorCodeStyle } from './GeneratorCode.style';
import { Scrollbar } from '@/components/css/scrollbar.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-generator-code': GeneratorCodeElement;
  }
}

export interface GeneratorCodeProps {}

export interface GeneratorCodeElement extends GeneratorCodeProps, HTMLElement {
  api: ERDEditorContext;
}

interface GeneratorCodeState {
  contextmenuX: number;
  contextmenuY: number;
  menus: Menu[] | null;
}

const GeneratorCode: FunctionalComponent<
  GeneratorCodeProps,
  GeneratorCodeElement
> = (props, ctx) => {
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
    state.menus = createGeneratorCodeMenus(ctx.api);
  };

  const onCloseContextmenu = () => (state.menus = null);

  const onMousedown = () => onCloseContextmenu();

  beforeMount(() => {
    const { canvasState } = ctx.api.store;

    unmountedGroup.push(
      watch(canvasState, propName => {
        if (propName !== 'language') return;
        const menue = state.menus?.find(menu => menu.name === 'Language');
        if (!menue) return;

        menue.children = createLanguageMenus(ctx.api);
      }),
      watch(canvasState, propName => {
        if (propName !== 'highlightTheme') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Highlight Theme'
        );
        if (!menue) return;

        menue.children = createHighlightThemeMenus(ctx.api);
      }),
      watch(canvasState, propName => {
        if (propName !== 'tableCase') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Table Name Case'
        );
        if (!menue) return;

        menue.children = createTableNameCaseMenus(ctx.api);
      }),
      watch(canvasState, propName => {
        if (propName !== 'columnCase') return;
        const menue = state.menus?.find(
          menu => menu.name === 'Column Name Case'
        );
        if (!menue) return;

        menue.children = createColumnNameCaseMenus(ctx.api);
      })
    );
  });

  return () => {
    const {
      canvasState: { highlightTheme, language },
    } = ctx.api.store;
    const code = createGeneratorCode(ctx.api.store);
    const codeHTML = hljs.highlight(languageMap[language], code).value;

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
                @close-contextmenu=${onCloseContextmenu}
              >
              </vuerd-contextmenu>
            `
          : null}
      </div>
    `;
  };
};

defineComponent('vuerd-generator-code', {
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: [GeneratorCodeStyle, Scrollbar].join(''),
  render: GeneratorCode,
});
