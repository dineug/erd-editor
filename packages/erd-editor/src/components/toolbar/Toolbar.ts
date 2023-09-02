import { FC, html } from '@dineug/r-html';

import * as styles from './Toolbar.styles';

export type ToolbarProps = {};

const Toolbar: FC<ToolbarProps> = (props, ctx) => {
  return () => html`<div class=${styles.root}>Toolbar</div>`;
};

export default Toolbar;
