import { css } from '@dineug/r-html';

/*
 * The row of tools over the middle of the bottom edge of the canvas, clear of
 * the scrollbar track under it and of the minimap in the corner. It stays in
 * zen mode, since the button that leaves zen mode is in it.
 */
export const root = css`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px;
  gap: 2px;
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  background-color: var(--toast-background);
  box-shadow: 0 1px 6px -3px var(--minimap-shadow);
  z-index: 1;
`;

// A bar's own tools are drawn as the view controls it holds are, so the tools
// of both floating bars and the controls in them restyle in one file.
export {
  compass,
  compassDistance,
  divider,
  menu,
  readout,
} from '@/components/erd/view-controls/viewControls.styles';
