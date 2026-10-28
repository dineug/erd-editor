import { css } from '@emotion/react';

// Root keeps the app and its theme from scrolling, so the page scrolls itself.
export const root = css`
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: auto;
`;

export const body = css`
  box-sizing: border-box;
  max-width: 960px;
  margin-inline: auto;
  padding-block: var(--space-6);
  padding-inline: var(--space-4);
`;

export const options = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
`;

export const fetchUrl = css`
  overflow-wrap: anywhere;
`;

// Faded rather than grayed, as in the sidebar's language menu.
export const hint = css`
  margin-inline-start: var(--space-2);
  opacity: 0.7;
`;

export const swatch = css`
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-inline-end: var(--space-2);
  border-radius: 50%;
  vertical-align: -1px;
`;

// Outlined outside its box, so the viewer gets the whole height an iframe would.
export const preview = css`
  width: 100%;
  border-radius: var(--radius-3);
  box-shadow: 0 0 0 1px var(--gray-a6);
  overflow: hidden;
`;

export const grow = css`
  flex: 1 1 auto;
  min-width: 0;
`;

export const copy = css`
  flex: none;
`;
