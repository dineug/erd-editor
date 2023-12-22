import { DefaultStyle } from '@/components/css';
import { SIZE_MENUBAR_HEIGHT } from '@/core/layout';
import { css } from '@/core/tagged';

export const DrawerStyle = css`
  .vuerd-drawer {
    position: absolute;
    top: ${SIZE_MENUBAR_HEIGHT}px;
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    color: var(--vuerd-color-font);
    opacity: 0.9;
    background-color: var(--vuerd-color-contextmenu);
    fill: #fff0;
    padding: 20px;
    box-sizing: border-box;
    z-index: 100;
  }

  .vuerd-drawer:hover {
    fill: var(--vuerd-color-font);
  }

  .vuerd-drawer-header {
    height: 30px;
    margin-bottom: 10px;
    overflow: hidden;
  }

  .vuerd-drawer-header > h3 {
    display: inline-block;
    margin: 0;
  }

  .vuerd-drawer-header > .vuerd-button {
    float: right;
  }

  .vuerd-drawer-body {
    height: calc(100% - 40px);
    overflow: auto;
    box-sizing: border-box;
  }

  ${DefaultStyle}
`;
