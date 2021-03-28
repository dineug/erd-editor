import { css } from '@/core/tagged';
import { SIZE_CONTEXTMENU_HEIGHT, SIZE_FONT } from '@/core/layout';

export const ContextmenuStyle = css`
  .vuerd-contextmenu {
    position: fixed;
    z-index: 1;
    opacity: 0.9;
    color: var(--vuerd-color-font);
    fill: var(--vuerd-color-font);
    background-color: var(--vuerd-color-contextmenu);
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    font-family: var(--vuerd-font-family) !important;
  }
  .vuerd-contextmenu > li {
    height: ${SIZE_CONTEXTMENU_HEIGHT}px;
    padding: 10px 5px 10px 10px;
    box-sizing: border-box;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    white-space: nowrap;
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .vuerd-contextmenu > li:hover {
    color: var(--vuerd-color-font-active);
    fill: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-contextmenu > li > span {
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 5px;
  }
  .vuerd-contextmenu > li > span.icon,
  .vuerd-contextmenu > li > span.icon > img {
    width: 18px;
    display: flex;
    align-items: center;
  }
  .vuerd-contextmenu > li > span.name {
    width: 70px;
    height: 17px;
  }
  .vuerd-contextmenu > li > span.keymap {
    width: 60px;
    display: inline-block;
    padding-right: 0;
  }
  .vuerd-contextmenu > li > span.arrow {
    width: 13px;
    padding-right: 0;
  }
`;
