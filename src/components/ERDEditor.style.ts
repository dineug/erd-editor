import { css } from '@/core/tagged';
import { SIZE_FONT } from '@/core/layout';

export const ERDEditorStyle = css`
  .vuerd-editor {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #f8f8f8;
  }

  .vuerd-ghost-text-helper {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }
`;