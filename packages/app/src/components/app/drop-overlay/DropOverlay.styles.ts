import { css } from '@emotion/react';

// It never takes the pointer, so the window keeps seeing the drag events it
// counts, and the drop lands on whatever lies beneath.
export const root = css`
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  padding: 16px;
  pointer-events: none;
  background-color: var(--color-overlay);
`;

export const frame = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  border: 2px dashed var(--accent-9);
  border-radius: var(--radius-5);
  background-color: var(--accent-a2);
`;

export const card = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-4);
  background-color: var(--color-panel-solid);
  box-shadow: var(--shadow-5);
  color: var(--accent-11);
  text-align: center;
`;
