import { css } from '@dineug/r-html';

export const vertical = css`
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: calc(100% - 8px);
  overflow: hidden;
  padding-top: 4px;
`;

export const horizontal = css`
  position: absolute;
  left: 0;
  bottom: 0;
  width: calc(100% - 8px);
  height: 8px;
  overflow: hidden;
  padding-left: 4px;
`;

export const ghostThumb = css`
  will-change: transform;
  cursor: pointer;

  &:hover > div {
    background-color: var(--scrollbar-thumb-hover);
  }

  &[data-selected] > div {
    background-color: var(--scrollbar-thumb-hover);
  }
`;

const thumb = css`
  background-color: var(--scrollbar-thumb);
  border-radius: 4px;
`;

export const verticalThumb = css`
  width: 4px;
  height: 100%;
  ${thumb};
`;

export const horizontalThumb = css`
  width: 100%;
  height: 4px;
  ${thumb};
`;
