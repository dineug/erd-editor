import { createRef, FC, html, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Canvas from '@/components/erd/canvas/Canvas';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { streamZoomLevelAction } from '@/engine/modules/settings/atom.actions';

import * as styles from './Erd.styles';

export type ErdProps = {};

const Erd: FC<ErdProps> = (props, ctx) => {
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const app = useAppContext(ctx);

  const handleContextmenu = (event: MouseEvent) => {
    contextMenu.onContextmenu(event);
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  const handleWheel = (event: WheelEvent) => {
    const { store } = app.value;
    store.dispatch(
      streamZoomLevelAction({ value: event.deltaY < 0 ? 0.1 : -0.1 })
    );
  };

  return () =>
    html`
      <div
        class=${styles.root}
        ${ref(root)}
        @contextmenu=${handleContextmenu}
        @mousedown=${contextMenu.onMousedown}
        @wheel=${handleWheel}
      >
        <${Canvas} />
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
