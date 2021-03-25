import { css } from '@/core/tagged';

export const ScrollbarStyle = css`
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
  .vuerd-scrollbar {
    scrollbar-color: var(--vuerd-color-scrollbar-thumb) #fff0;
    scrollbar-width: auto;
  }
`;
