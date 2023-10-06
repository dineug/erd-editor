import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';
import { useContextMenuSubContext } from '@/components/primitives/context-menu/context-menu-sub/contextMenuSubContext';
import { uuid } from '@/utils';

export type ContextMenuSubTriggerProps = {
  children?: DOMTemplateLiterals;
};

const ContextMenuSubTrigger: FC<ContextMenuSubTriggerProps> = (props, ctx) => {
  const id = uuid();
  const sub = useContextMenuSubContext(ctx);

  const handleMouseover = (event: MouseEvent) => {
    sub.value.onMouseover(event, id);
  };

  return () =>
    html`
      <div
        class=${['context-menu-sub-trigger', styles.item]}
        data-id=${id}
        data-show=${sub.value.show}
        @mouseover=${handleMouseover}
      >
        ${props.children}
      </div>
    `;
};

export default ContextMenuSubTrigger;
