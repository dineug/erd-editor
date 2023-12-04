import { css } from '@dineug/r-html';

const cell = css`
  padding: 12px;
  height: 44px;
  box-shadow: inset 0 -1px var(--gray-color-5);
`;

export const table = css`
  width: 100%;
  text-align: left;
  vertical-align: top;
  border-collapse: collapse;
  border-radius: calc(var(--table-border-radius) - 1px);
  border-spacing: 0;
  box-sizing: border-box;
  height: 0;

  th {
    font-weight: var(--font-weight-bold);
    ${cell};
  }

  td {
    ${cell};
  }
`;

export const shortcutGroup = css`
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`;
