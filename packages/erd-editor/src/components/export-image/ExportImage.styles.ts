import { css } from '@dineug/r-html';

import { fontSize4, typography } from '@/styles/typography.styles';

/**
 * The preview beside the options, or above them once the editor is narrow,
 * kept at its own height so a short editor scrolls the box rather than cut it.
 */
export const layout = css`
  display: flex;
  flex: 0 0 auto;

  &.stacked {
    flex-direction: column;
  }
`;

/**
 * A checkerboard under the image, so a background left out reads as left out.
 * The image is fitted inside a fixed inset whatever its proportions.
 */
export const preview = css`
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 320px;
  background-color: var(--gray-color-2);
  background-image: conic-gradient(
    var(--gray-color-4) 25%,
    transparent 0 50%,
    var(--gray-color-4) 0 75%,
    transparent 0
  );
  background-size: 16px 16px;

  .stacked > & {
    flex: 0 0 auto;
    min-height: 0;
    height: 200px;
  }
`;

export const image = css`
  position: absolute;
  inset: 16px;
  width: calc(100% - 32px);
  height: calc(100% - 32px);
  object-fit: contain;
`;

/* A turning ring over the preview while one is drawn; the last picture stays under it. */
export const loading = css`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border: 2px solid var(--gray-color-6);
  border-top-color: var(--accent-color-9);
  border-radius: 50%;
  animation: exportImageLoading 0.8s linear infinite;

  @keyframes exportImageLoading {
    to {
      transform: rotate(360deg);
    }
  }
`;

/* Wide enough for PNG, SVG and Copy to clipboard to share one row. */
export const panel = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 0 0 328px;
  padding: 20px;
  border-left: 1px solid var(--context-menu-border);
  color: var(--foreground);
  ${typography.normal};

  .stacked > & {
    flex: 0 0 auto;
    border-left: none;
    border-top: 1px solid var(--context-menu-border);
  }

  & button:focus-visible {
    outline: 2px solid var(--input-active);
    outline-offset: 2px;
  }
`;

export const title = css`
  margin: 0 0 4px;
  color: var(--active);
  font-weight: var(--font-weight-medium);
  ${fontSize4};
`;

/* A label and its control on one line, the label taking what is left. */
export const row = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
`;

/* The three scales as one segmented control. */
export const scales = css`
  display: inline-flex;
  border: 1px solid var(--context-menu-border);
  border-radius: 6px;
  overflow: hidden;
`;

export const scale = css`
  min-width: 40px;
  height: 26px;
  padding: 0 8px;
  color: var(--foreground);
  cursor: pointer;
  ${typography.paragraph};

  & + & {
    border-left: 1px solid var(--context-menu-border);
  }

  &:hover {
    color: var(--active);
    background-color: var(--context-menu-hover);
  }

  &[aria-pressed='true'] {
    color: var(--accent-color-11);
    background-color: var(--accent-color-3);
  }
`;

/* The pixels the file will hold, and a note when a canvas ceiling cut them. */
export const size = css`
  min-height: 20px;
  color: var(--active);
  font-variant-numeric: tabular-nums;
`;

export const warning = css`
  margin-top: -8px;
  color: var(--placeholder);
  ${typography.paragraph};
`;

export const actions = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
`;
