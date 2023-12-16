import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from './Menu.styles';

export type MenuProps = {
  icon: DOMTemplateLiterals | string;
  name: DOMTemplateLiterals | string;
  right?: DOMTemplateLiterals | string;
};

const Menu: FC<MenuProps> = (props, ctx) => () => html`
  <div class=${styles.menu}>
    <div class=${styles.icon}>${props.icon}</div>
    <div>${props.name}</div>
    ${props.right
      ? html`<div class=${styles.right}>${props.right}</div>`
      : null}
  </div>
`;

export default Menu;
