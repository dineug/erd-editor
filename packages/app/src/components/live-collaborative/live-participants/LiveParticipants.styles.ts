import { css } from '@emotion/react';

/**
 * Where the panel would reach the editor's tool bar, centred on the same bottom
 * edge and up to about 360px wide. Below it the panel stacks over the bar.
 */
export const narrowQuery = '(max-width: 860px)';

export const root = css`
  position: absolute;
  left: 16px;
  bottom: 24px;
  z-index: 1;
  width: 220px;
  max-width: calc(100% - 32px);

  @media ${narrowQuery} {
    bottom: 72px;
  }
`;

export const title = css`
  flex: 1;
  min-width: 0;
`;

export const list = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 160px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
`;

export const item = css`
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
`;

export const name = css`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
