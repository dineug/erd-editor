import { createGlobalStyle } from 'styled-components';

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
`;
