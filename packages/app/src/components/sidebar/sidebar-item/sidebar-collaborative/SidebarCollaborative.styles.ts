import { css } from '@emotion/react';

export const collaborative = css`
  flex: none;
  position: relative;
  margin: 0;
  color: var(--gray-a10);

  &[data-active='true'] {
    color: var(--gray-12);
    visibility: visible;
  }
`;

export const link = css`
  cursor: pointer;

  & > * {
    pointer-events: none;
  }
`;

export const count = css`
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-align: center;
  color: var(--gray-1);
  background-color: var(--gray-12);
  pointer-events: none;
`;

export const participants = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 160px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
`;

export const participant = css`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`;

export const name = css`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
