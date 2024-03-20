import { css } from '@dineug/r-html';

export const root = css`
  display: flex;
  width: 100%;
  height: 12px;
  position: relative;
  align-items: center;
  user-select: none;
  touch-action: none;
`;

export const track = css`
  width: 100%;
  height: 8px;
  background-color: var(--gray-color-3);
  box-shadow: inset 0 0 0 1px var(--gray-color-6);
  overflow: hidden;
  position: relative;
  border-radius: 9999px;
`;

export const range = css`
  position: absolute;
  border-radius: inherit;
  background-color: var(--accent-color-9);
  box-shadow: inset 0 0 0 1px var(--gray-color-6);
  top: 0;
  width: 100%;
  height: 100%;
`;

export const thumb = css`
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: white;
  border-radius: 9999px;

  &::before {
    content: '';
    position: absolute;
    width: calc(12px * 3);
    height: calc(12px * 3);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  &::after {
    content: '';
    position: absolute;
    background-color: white;
    border-radius: 9999px;
    inset: calc(-0.25 * 8px);
    box-shadow: inset 0 0 0 1px var(--gray-color-6);
    cursor: pointer;
  }
`;
