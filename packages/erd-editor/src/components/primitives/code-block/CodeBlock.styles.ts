import { css } from '@dineug/r-html';

export const clipboard = css`
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  margin: 8px;
  cursor: pointer;
  fill: var(--foreground);
  color: var(--foreground);
  opacity: 0;
  transition: opacity 0.15s;

  &:hover {
    fill: var(--active);
    color: var(--active);
  }
`;

export const root = css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  min-height: 40px;
  outline: none;

  &:hover {
    ${clipboard} {
      opacity: 1;
    }
  }
`;

export const code = css`
  width: 100%;
  height: 100%;
  white-space: pre;
  overflow: auto;
  outline: none;
  font-family: var(--code-font-family) !important;
  color: var(--active);
  padding: 16px;
`;
