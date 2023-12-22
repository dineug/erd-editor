import { css } from '@/core/tagged';

import { ScrollbarStyle } from './scrollbar.style';

export const DefaultStyle = css`
  .vuerd-button {
    cursor: pointer;
  }
  .vuerd-button:hover {
    fill: var(--vuerd-color-font-active);
  }

  ${ScrollbarStyle}
`;
