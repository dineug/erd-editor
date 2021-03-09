import { css } from '@/core/tagged';
import { SIZE_MENUBAR_HEIGHT } from '@/core/layout';
import { DefaultStyle } from '@/components/css';

export const DrawerStyle = css`
  .vuerd-drawer {
    position: absolute;
    top: ${SIZE_MENUBAR_HEIGHT}px;
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    color: var(--vuerd-color-font);
    opacity: 0.9;
    background-color: var(--vuerd-color-contextmenu);
    z-index: 100000050;
    fill: #fff0;
    padding: 20px;
    box-sizing: border-box;
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
