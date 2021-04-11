import { css } from '@/core/tagged';

export const GridEditorStyle = css`
  .vuerd-grid-editor {
    position: relative;
    height: 100%;
    background-color: var(--vuerd-color-table);
    overflow: hidden;
  }

  .vuerd-grid-container {
    position: relative;
    height: 100%;
    z-index: 1;
  }
`;
