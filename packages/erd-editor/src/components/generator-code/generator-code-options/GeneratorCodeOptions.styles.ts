import { css } from '@dineug/r-html';

/** A setting's name over its list, broken anywhere sooner than past the panel. */
export const name = css`
  overflow-wrap: anywhere;
`;

/**
 * A setting, its name on a line of its own over a list as wide as the panel,
 * so a long name in any language never squeezes the list beside it.
 */
export const setting = css`
  & > select {
    width: 100%;
  }
`;

/** A setting the language ignores: its name and its value dimmed, still to be changed. */
export const unused = css`
  & label,
  & select {
    color: var(--placeholder);
  }
`;
