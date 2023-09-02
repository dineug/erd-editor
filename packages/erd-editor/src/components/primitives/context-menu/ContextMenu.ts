import { FC, html } from '@dineug/r-html';

import * as styles from './ContextMenu.styles';

export type ContextMenuProps = {};

const ContextMenu: FC<ContextMenuProps> = (props, ctx) => {
  return () => html`<div>ContextMenu</div>`;
};

export default ContextMenu;
