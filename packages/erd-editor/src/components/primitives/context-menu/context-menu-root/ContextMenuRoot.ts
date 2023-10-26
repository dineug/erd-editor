import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import { useContextMenuRootContext } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

export type ContextMenuRootProps = {
  children?: DOMTemplateLiterals;
};

const ContextMenuRoot: FC<ContextMenuRootProps> = (props, ctx) => {
  const root = useContextMenuRootContext(ctx);

  return () =>
    root.value.show
      ? html`
          <${ContextMenuContent}
            id="root"
            x=${root.value.x}
            y=${root.value.y}
            children=${props.children}
          />
        `
      : null;
};

export default ContextMenuRoot;
