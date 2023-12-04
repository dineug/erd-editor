import { css } from '@dineug/r-html';

export const root = css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
  }
`;

export const container = css`
  width: 100%;
  max-width: 900px;
  max-height: calc(100% - 32px);
  overflow: auto;
  z-index: 1;
  border-radius: 6px;
  padding: 12px;
  background-color: var(--context-menu-background);
  border: 1px solid var(--context-menu-border);
`;
