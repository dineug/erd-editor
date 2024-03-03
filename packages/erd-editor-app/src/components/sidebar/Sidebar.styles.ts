import { css } from '@emotion/react';

export const root = css`
  width: 260px;
  min-width: 260px;
  height: 100%;
  overflow: hidden;
  background-color: var(--gray-2);
  padding: 14px 0;
  border-right: 1px solid var(--gray-6);
  position: relative;
`;

export const hide = css`
  display: none;
`;

export const header = css`
  padding: 0 12px;
  margin-bottom: 24px;
`;

export const addButton = css`
  width: 100%;
`;

export const contentArea = css`
  width: 260px;
  min-width: 260px;
  padding: 0 12px;
  height: 100%;
`;

export const empty = css`
  width: 5px;
  min-width: 5px;
  height: 100%;
  background-color: var(--gray-6);
`;
