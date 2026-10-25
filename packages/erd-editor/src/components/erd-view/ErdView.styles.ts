import { css } from '@dineug/r-html';

/*
 * The box the read-only view fills, which the canvas, its scrollbars and its
 * controls stand in. It takes the touch gestures off the browser only while it
 * holds the focus, so before that a finger over bare canvas scrolls the page.
 */
export const root = css`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;

  &:focus-within {
    touch-action: none;
  }
`;

/*
 * The notice a load shows over the middle of the canvas, drawn as a status
 * toast is: a turning loader while the document loads, a warning once it failed.
 * Presses go through it to the canvas, which still pans under it.
 */
export const status = css`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 32px);
  padding: 8px 12px;
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  color: var(--foreground);
  pointer-events: none;
  z-index: 1;

  & > .icon {
    flex: none;
  }

  &[data-busy] svg {
    animation: viewStatusSpin 0.9s linear infinite;
  }

  &[data-tone='error'] > .icon {
    color: var(--toast-error);
  }

  @keyframes viewStatusSpin {
    to {
      transform: rotate(360deg);
    }
  }
`;
