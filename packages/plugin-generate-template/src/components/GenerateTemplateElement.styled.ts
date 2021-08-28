import { createGlobalStyle } from 'styled-components';

import { TippyStyle } from '@/components/css/tippy.style';
import { TuiGridStyle } from '@/components/css/tui-grid/tui-grid.style';
import { TuiGridThemeStyle } from '@/components/css/tui-grid/tui-grid-theme.style';
import { GridTextEditorStyle } from '@/components/grid/GridTextEditor.style';
import { GridTextRenderStyle } from '@/components/grid/GridTextRender.style';

export const GlobalStyle = createGlobalStyle`
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  ::-webkit-scrollbar-track {
    background: #fff0;
  }
  ::-webkit-scrollbar-corner {
    background: #fff0;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--vuerd-color-scrollbar-thumb);
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--vuerd-color-scrollbar-thumb-active);
  }

  /* firefox */
  .scrollbar {
    scrollbar-color: var(--vuerd-color-scrollbar-thumb) #fff0;
    scrollbar-width: auto;
  }

  .cm-editor {
    height: 100%
  }

  .tooltip {
    display: flex;
    align-items: center;
  }

  ${TippyStyle}
  ${TuiGridStyle}
  ${TuiGridThemeStyle}
  ${GridTextEditorStyle}
  ${GridTextRenderStyle}
`;
