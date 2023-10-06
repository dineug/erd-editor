import { createRef, FC, html, ref } from '@dineug/r-html';

import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

import * as styles from './Erd.styles';

export type ErdProps = {};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();

  const handleContextmenu = (event: MouseEvent) => {
    contextMenu.onContextmenu(event);
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  return () =>
    html`
      <div
        class=${styles.root}
        ${ref(root)}
        @contextmenu=${handleContextmenu}
        @mousedown=${contextMenu.onMousedown}
      >
        ERD
        ${contextMenu.state.show
          ? html`
              <${ErdContextMenu}
                type=${ErdContextMenuType.ERD}
                root=${root}
                .onClose=${handleContextmenuClose}
              />
            `
          : null}
      </div>
    `;
};

export default Erd;
