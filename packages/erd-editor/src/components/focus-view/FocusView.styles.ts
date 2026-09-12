import { css } from '@dineug/r-html';

import * as toolbarStyles from '@/components/toolbar/Toolbar.styles';
import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

/*
 * The overlay, laid over the tab area alone: it stands on the bottom edge at
 * the viewport's size, the root less the toolbar, so the toolbar beside every
 * scene stays in reach; raised the one step the panels of a tab raise themselves, so it paints over them.
 */
export const root = css`
  position: absolute;
  left: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  overflow: hidden;
  background-color: var(--canvas-boundary-background);
`;

/**
 * The scene box, which keeps the viewport's size under the bar. The map and
 * its frame are set down by the bar's height so none of them is drawn under it.
 */
export const scene = css`
  & > .minimap,
  & > .minimap-border,
  & > .minimap-viewport {
    margin-top: ${FOCUS_BAR_HEIGHT}px;
  }
`;

/*
 * The bar over the top of the scene: the toolbar's own bar, at its height,
 * laid over rather than beside, so the scene box under it keeps the
 * viewport's size and the map reads the screen it draws; the fit keeps clear of it by the same height.
 */
export const bar = css`
  ${toolbarStyles.root};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  height: ${FOCUS_BAR_HEIGHT}px;
  ${typography.paragraph};
`;

export const label = css`
  display: flex;
  align-items: center;
  margin-right: 10px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/** The toolbar's menu, with the one state the trail's ends add: a step there is none of. */
export const menu = css`
  ${toolbarStyles.menu};

  &.disabled {
    cursor: not-allowed;
    color: var(--placeholder);
  }
`;
