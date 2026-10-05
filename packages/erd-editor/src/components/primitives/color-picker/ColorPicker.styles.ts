import { css } from '@dineug/r-html';

import { floatingShadow } from '@/styles/elevation.styles';
import { fontSize1 } from '@/styles/typography.styles';

export const container = css`
  position: absolute;
`;

/** Stacks over the floating toolbar, z-index 1, as the context menu does. */
export const panel = css`
  position: relative;
  z-index: 2;
  width: 220px;
  border: 1px solid var(--context-menu-border);
  border-radius: 4px;
  background-color: var(--context-menu-background);
  ${floatingShadow};
  outline: none;
  user-select: none;
`;

export const body = css`
  padding: 10px 10px 8px;
`;

/*
 * Black rises from the foot and white fades in from the left over the hue the
 * element is painted, so saturation runs across and brightness up. The colors
 * sit under a color of the document's, so forced colors leave them be.
 */
export const area = css`
  position: relative;
  height: 150px;
  border-radius: 2px;
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
  touch-action: none;
  forced-color-adjust: none;

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

/** White ringed in black reads on any color under it, so it ignores the theme. */
export const areaThumb = css`
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translate(-5px, -5px);
  box-shadow:
    0 0 0 1.5px #fff,
    0 0 1px 2px rgba(0, 0, 0, 0.4),
    inset 0 0 1px 1px rgba(0, 0, 0, 0.3);
  pointer-events: none;
`;

export const controls = css`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  margin-top: 4px;
`;

export const iconButton = css`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--foreground);
  cursor: pointer;

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

/** The bar is 10px tall; its ::before takes a press anywhere in the 24px row. */
export const hue = css`
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 2px;
  background-image: linear-gradient(
    to right,
    #f00 0%,
    #ff0 16.667%,
    #0f0 33.333%,
    #0ff 50%,
    #00f 66.667%,
    #f0f 83.333%,
    #f00 100%
  );
  cursor: pointer;
  touch-action: none;
  forced-color-adjust: none;

  &::before {
    content: '';
    position: absolute;
    inset: -7px 0;
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 1px;
  }
`;

export const hueThumb = css`
  position: absolute;
  top: 1px;
  bottom: 1px;
  width: 4px;
  border-radius: 1px;
  transform: translateX(-2px);
  background-color: #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
`;

export const preview = css`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px var(--context-menu-border);
  forced-color-adjust: none;
`;

export const fields = css`
  display: flex;
  gap: 6px;
  padding: 0 10px 8px;
`;

/** One of R, G and B; Hex takes hexField, never both, as two sheets would race. */
export const field = css`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

export const hexField = css`
  display: flex;
  flex: 2;
  flex-direction: column;
  min-width: 58px;
`;

/** A real border, which forced colors keeps where it drops a box shadow. */
export const input = css`
  width: 100%;
  height: 22px;
  padding: 0 4px;
  border: 1px solid var(--context-menu-border);
  border-radius: 2px;
  ${fontSize1};

  &:focus {
    border-color: var(--input-active);
  }
`;

export const fieldLabel = css`
  margin-top: 2px;
  text-align: center;
  color: var(--foreground);
  ${fontSize1};
`;

export const swatchArea = css`
  padding: 10px 10px 0;
  border-top: 1px solid var(--context-menu-border);
`;

/** Eight 16px columns and seven 10px gaps fill the 198px inside the panel exactly. */
export const swatches = css`
  display: grid;
  grid-template-columns: repeat(8, 16px);
  gap: 10px;
  margin-bottom: 10px;
`;

export const caption = css`
  margin-bottom: 6px;
  color: var(--foreground);
  ${fontSize1};
`;

/*
 * The edge follows the theme, so a dark swatch shows on a dark panel and a
 * light one on a light panel. The check is a ring in box-shadow and the focus
 * an outline outside it, so the two never cover each other.
 */
export const swatch = css`
  width: 16px;
  height: 16px;
  border-radius: 3px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--context-menu-border);
  forced-color-adjust: none;

  &[aria-checked='true'] {
    box-shadow:
      inset 0 0 0 1px var(--context-menu-border),
      0 0 0 2px var(--context-menu-background),
      0 0 0 3px var(--gray-color-12);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 3px;
  }
`;

export const clear = css`
  display: block;
  width: 100%;
  height: 28px;
  padding: 0 12px;
  border-top: 1px solid var(--context-menu-border);
  border-radius: 0 0 3px 3px;
  color: var(--foreground);
  cursor: pointer;
  ${fontSize1};

  &:hover {
    background-color: var(--context-menu-hover);
    color: var(--active);
  }

  &:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: -2px;
  }
`;
