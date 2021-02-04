import { css } from '@/core/tagged';
import { SIZE_MENUBAR_HEIGHT } from '@/core/layout';

export const menubarStyle = css`
  .vuerd-menubar {
    display: flex;
    height: ${SIZE_MENUBAR_HEIGHT}px;
    align-items: center;
    overflow: hidden;
    background-color: var(--vuerd-color-menubar);
  }
`;
