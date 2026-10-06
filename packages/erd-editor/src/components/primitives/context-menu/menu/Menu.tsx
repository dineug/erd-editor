import { DOMTemplateLiterals, FC } from '@dineug/r-html';

import * as styles from './Menu.styles';

export type MenuProps = {
  // null is a value a text position renders as nothing, and the context menus
  // rely on that for the check marks they show conditionally.
  icon?: DOMTemplateLiterals | string | null;
  name: DOMTemplateLiterals | string;
  /** A name kept as written, a vendor or a code language such as C#, which reads left to right in any language. */
  literal?: boolean;
  right?: DOMTemplateLiterals | string | null;
};

const Menu: FC<MenuProps> = (props, ctx) => () => (
  <div class={styles.menu}>
    <div class={styles.icon}>{props.icon}</div>
    {props.literal ? (
      <div prop:dir="ltr">{props.name}</div>
    ) : (
      <div>{props.name}</div>
    )}
    {props.right ? <div class={styles.right}>{props.right}</div> : null}
  </div>
);

export default Menu;
