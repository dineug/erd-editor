import { css } from '@/core/tagged';

export const FilterStyle = css`
  .vuerd-filter {
    width: 338px;
    display: flex;
    flex-direction: column;
    padding: 0 10px;
    box-sizing: border-box;
    position: absolute;
    right: 190px;
    color: var(--vuerd-color-font);
    background-color: var(--vuerd-color-menubar);
    opacity: 0.9;
    fill: #fff0;
    z-index: 2;
    padding: 10px;
  }

  .vuerd-filter:hover {
    fill: var(--vuerd-color-font);
  }

  .vuerd-filter .vuerd-filter-header {
    white-space: nowrap;
  }

  .vuerd-filter .vuerd-filter-header .vuerd-button {
    margin-left: 5px;
    float: right;
  }

  .vuerd-filter-item-move {
    transition: transform 0.3s;
  }
`;
