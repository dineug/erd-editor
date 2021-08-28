import { SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const GridTextRenderStyle = css`
  .vuerd-grid-text {
    width: 100%;
    height: 100%;
    padding: 7px 6px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font-active);
    border-bottom: solid #fff0 1.5px;
    box-sizing: border-box;
  }

  .vuerd-grid-text.placeholder {
    color: var(--vuerd-color-font-placeholder);
  }
`;
