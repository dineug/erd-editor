import { css } from '@dineug/r-html';

/** Spliced into both layers: a textarea inherits none of `:host`'s typography, the preview does. */
const layer = css`
  padding: 16px;
  font-family: var(--code-font-family);
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  letter-spacing: var(--letter-spacing-2);
  font-weight: var(--font-weight-regular);
  font-kerning: none;
  font-synthesis: none;
  font-variant-ligatures: none;
  font-variant-caps: normal;
  font-style: normal;
  text-transform: none;
  white-space: pre;
  text-align: left;
  text-indent: 0;
  word-spacing: normal;
  tab-size: 8;
  -webkit-text-size-adjust: 100%;
`;

export const clipboard = css`
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  margin: 8px;
  cursor: pointer;
  fill: var(--foreground);
  color: var(--foreground);
  opacity: 0;
  transition: opacity 0.15s;
  -webkit-user-select: none;
  user-select: none;

  &:hover {
    fill: var(--active);
    color: var(--active);
  }
`;

export const root = css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  min-height: 40px;
  outline: none;

  &:hover {
    ${clipboard} {
      opacity: 1;
    }
  }
`;

/** Out of flow, the root loses its content height and collapses to `min-height`. */
export const scroller = css`
  width: 100%;
  height: 100%;
  overflow: auto;
`;

/** Sized by the preview, so the overlay stretched onto it has no scroll of its own to desync. */
export const layers = css`
  position: relative;
  width: max-content;
  min-width: 100%;
  min-height: 100%;
`;

export const preview = css`
  ${layer};
  color: var(--active);
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;

  /* the UA matches pre and code directly, which beats anything this rule only inherits down */
  & * {
    margin: 0;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    letter-spacing: inherit;
  }
`;

export const textarea = css`
  ${layer};
  position: absolute;
  inset: 0;
  overflow: hidden;
  resize: none;
  appearance: none;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background-color: transparent;
  caret-color: var(--active);

  /* painted above the code, so the band has to stay translucent — --placeholder is grayA-10 */
  &::selection {
    color: transparent;
    -webkit-text-fill-color: transparent;
    background-color: var(--placeholder);
  }
`;
