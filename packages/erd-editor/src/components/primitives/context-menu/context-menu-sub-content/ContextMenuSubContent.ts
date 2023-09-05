import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent.styles';
import { useContextMenuSubContext } from '@/components/primitives/context-menu/context-menu-sub/contextMenuSubContext';

export type ContextMenuSubContentProps = {
  children?: DOMTemplateLiterals;
};

const ContextMenuSubContent: FC<ContextMenuSubContentProps> = (props, ctx) => {
  const sub = useContextMenuSubContext(ctx);

  const handleMouseover = (event: MouseEvent) => {
    event.stopPropagation();
    const el = event.target as HTMLElement | null;
    if (!el) return;

    if (el.dataset.id) {
      sub.value.setHoveredId(el.dataset.id);
    }
  };

  return () =>
    sub.value.show
      ? html`
          <div
            class=${['context-menu-content', styles.content]}
            style=${{ left: `${sub.value.x}px`, top: `${sub.value.y}px` }}
            @mouseover=${handleMouseover}
          >
            ${props.children}
          </div>
        `
      : null;
};

export default ContextMenuSubContent;
