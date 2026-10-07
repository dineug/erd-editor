import { css } from '@dineug/r-html';

/** Spliced into both layers, so the highlighted text wraps where the caret's does. */
const layer = css`
  margin: 0;
  padding: 8px;
  box-sizing: border-box;
  font-family: var(--code-font-family);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
  font-weight: var(--font-weight-regular);
  font-kerning: none;
  font-variant-ligatures: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 8;
  text-align: left;
`;

/**
 * The box both layers fill, its background the highlight's, set inline, and a
 * stacking context of its own, so the raised field stays under the overlays.
 */
export const editor = css`
  position: relative;
  isolation: isolate;
  border: 1px solid var(--context-menu-border);
  border-radius: 4px;
  overflow: hidden;

  &:focus-within {
    border-color: var(--focus);
  }
`;

/**
 * The field a reader types into, in flow and as tall as its text, raised over
 * the preview, which an absolute box would otherwise paint above it.
 */
export const input = css`
  ${layer};
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-height: 110px;
  border: 0;
  outline: none;
  resize: none;
  overflow: hidden;
  background: transparent;
  color: transparent;
  -webkit-text-fill-color: transparent;
  caret-color: var(--active);

  &::selection {
    color: transparent;
    -webkit-text-fill-color: transparent;
    background-color: var(--placeholder);
  }

  /* the reset gives every placeholder the text font, a hint here being SQL */
  &::placeholder {
    font-family: inherit;
    color: #6a737d;
    -webkit-text-fill-color: #6a737d;
  }
`;

/** The highlighted text under the field, stretched onto it. */
export const preview = css`
  ${layer};
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  color: var(--active);
  -webkit-user-select: none;
  user-select: none;

  /* the UA matches pre and code directly, which beats anything this rule only inherits down */
  & pre,
  & code,
  & span {
    margin: 0;
    padding: 0;
    font: inherit;
    white-space: inherit;
    overflow-wrap: inherit;
    background: none;
  }
`;
