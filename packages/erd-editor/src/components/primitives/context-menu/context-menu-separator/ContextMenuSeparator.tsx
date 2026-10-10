import { FC } from '@dineug/r-html';

import * as styles from './ContextMenuSeparator.styles';

/**
 * A rule between groups of rows, which opens and runs nothing. A sibling of the
 * rows, never their wrapper, since a row finds its menu by its parent's data-id.
 */
const ContextMenuSeparator: FC = () => () => (
  <div
    class={['context-menu-separator', styles.separator]}
    role="separator"
  ></div>
);

export default ContextMenuSeparator;
