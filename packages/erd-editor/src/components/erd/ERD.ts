import { FC, html } from '@dineug/r-html';

import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';

import * as styles from './ERD.styles';

export type ERDProps = {};

const ERD: FC<ERDProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);

  const handleContextmenu = (event: MouseEvent) => {
    contextMenu.onContextmenu(event);
  };

  return () =>
    html`
      <div
        class=${styles.root}
        @contextmenu=${handleContextmenu}
        @mousedown=${contextMenu.onMousedown}
      >
        ERD ${contextMenu.state.show ? html`` : null}
      </div>
    `;
};

export default ERD;
