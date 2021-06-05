import { SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const TablePropertiesDrawerStyle = css`
  .vuerd-table-properties {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .vuerd-table-properties-tab {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    margin-bottom: 10px;
  }
  .vuerd-table-properties-tab > li {
    padding: 10px;
    box-sizing: border-box;
    cursor: pointer;
    font-size: ${SIZE_FONT}px;
    white-space: nowrap;
    display: inline-block;
  }
  .vuerd-table-properties-tab > li:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  .vuerd-table-properties-tab > li.active {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }

  .vuerd-table-properties-body {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`;
