import { css } from '@dineug/r-html';

export const root = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--canvas-boundary-background);
`;

export const container = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  pointer-events: none;

  .minimap-viewport {
    display: none;
  }
`;

export const slider = css`
  padding: 0 15px;
  display: flex;
  width: 100%;
  height: 30px;
  overflow: hidden;
  position: absolute;
  left: 0;
  bottom: 0;
  background-color: var(--canvas-boundary-background);
  align-items: center;

  & > button:last-child {
    margin-left: 8px;
  }
`;

export const vertical = css`
  width: 24px;
  height: 100%;
`;
