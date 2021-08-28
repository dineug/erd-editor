import { SIZE_FONT } from '@/core/layout';
import { css } from '@/core/tagged';

export const GridTextEditorStyle = css`
  input.vuerd-grid-input {
    width: 100%;
    height: 100%;
    outline: none;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-table);
    border-top: none !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: solid var(--vuerd-color-edit) 1.5px !important;
  }
`;
