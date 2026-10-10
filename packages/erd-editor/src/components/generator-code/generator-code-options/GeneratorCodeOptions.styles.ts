import { css } from '@dineug/r-html';

/** A setting's name over its list, broken anywhere sooner than past the panel. */
export const name = css`
  overflow-wrap: anywhere;
`;

/** A setting the language ignores: its name dimmed, as its list dims its value, still to be changed. */
export const unused = css`
  & label {
    color: var(--placeholder);
  }
`;
