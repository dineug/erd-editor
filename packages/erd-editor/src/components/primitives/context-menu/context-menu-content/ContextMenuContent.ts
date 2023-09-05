import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import { useContextMenuRootContext } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

import * as styles from './ContextMenuContent.styles';

export type ContextMenuContentProps = {
  children?: DOMTemplateLiterals;
};

const ContextMenuContent: FC<ContextMenuContentProps> = (props, ctx) => {
  const root = useContextMenuRootContext(ctx);

  const handleMouseover = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    if (el.dataset.id) {
      root.value.setHoveredId(el.dataset.id);
    }
  };

  return () =>
    root.value.show
      ? html`
          <div
            class=${['context-menu-content', styles.content]}
            style=${{ left: `${root.value.x}px`, top: `${root.value.y}px` }}
            @mouseover=${handleMouseover}
          >
            ${props.children}
          </div>
        `
      : null;
};

export default ContextMenuContent;
