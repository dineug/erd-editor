import { FC, html } from '@dineug/r-html';

import { Column } from '@/internal-types';

import * as styles from './Column.styles';

export type ColumnProps = {
  column: Column;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  return () => html`<div class=${styles.root}>column</div>`;
};

export default Column;
