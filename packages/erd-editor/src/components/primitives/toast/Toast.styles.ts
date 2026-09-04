import { css } from '@dineug/r-html';

import { fontSize2, typography } from '@/styles/typography.styles';

export const root = css`
  display: flex;
  align-items: center;
  border-radius: 6px;
  width: fit-content;
  padding: 15px;
  background-color: var(--toast-background);
  border: 1px solid var(--toast-border);
`;

/**
 * The ring beside the text of a toast that reports something still running.
 * A busy one turns a quarter of it; one with a progress fills it from the top.
 */
export const indicator = css`
  flex: none;
  width: 16px;
  height: 16px;
  margin-right: 12px;
  color: var(--active);

  & svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  & [data-part='track'] {
    stroke: var(--toast-border);
  }

  & [data-part='arc'] {
    stroke: currentColor;
    transition: stroke-dashoffset 0.2s;
  }

  &[data-busy] svg {
    animation: toastSpin 0.9s linear infinite;
  }

  @keyframes toastSpin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const textWrap = css`
  overflow-wrap: anywhere;

  & > div {
    margin-bottom: 5px;
  }

  & > div:last-child {
    margin-bottom: 0;
  }
`;

export const title = css`
  color: var(--active);
  font-weight: var(--font-weight-medium);
  ${fontSize2};
`;

export const description = css`
  ${typography.paragraph};
`;

export const action = css`
  display: flex;
  margin-left: 15px;

  & > button {
    margin-left: 8px;
  }

  & > button:first-child {
    margin-left: 0;
  }
`;
