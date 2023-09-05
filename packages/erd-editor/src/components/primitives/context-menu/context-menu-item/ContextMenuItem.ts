import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import { uuid } from '@/utils';

import * as styles from './ContextMenuItem.styles';

export type ContextMenuItemProps = {
  children?: DOMTemplateLiterals;
  onClick?: (event: MouseEvent) => void;
};

const ContextMenuItem: FC<ContextMenuItemProps> = (props, ctx) => {
  const id = uuid();

  return () =>
    html`
      <div class=${styles.item} data-id=${id} @click=${props.onClick}>
        ${props.children}
      </div>
    `;
};

export default ContextMenuItem;
