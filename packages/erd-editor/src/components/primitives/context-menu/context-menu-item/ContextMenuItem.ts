import {
  createRef,
  DOMTemplateLiterals,
  FC,
  html,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
import { nanoid } from '@dineug/shared';

import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import { useContextMenuRootContext } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { useUnmounted } from '@/hooks/useUnmounted';

import * as styles from './ContextMenuItem.styles';

export type ContextMenuItemProps = {
  children?: DOMTemplateLiterals;
  subChildren?: DOMTemplateLiterals;
  onClick?: (event: MouseEvent) => void;
};

const ContextMenuItem: FC<ContextMenuItemProps> = (props, ctx) => {
  const root = useContextMenuRootContext(ctx);
  const id = nanoid();
  const $div = createRef<HTMLDivElement>();
  const state = observable({
    selected: false,
    show: false,
    x: 0,
    y: 0,
  });
  const { addUnsubscribe } = useUnmounted();

  const handleMouseenter = () => {
    const { width, x, y } = $div.value.getBoundingClientRect();
    state.x = width + x;
    state.y = y - 8;
    state.show = true;

    const parentId = $div.value.parentElement?.dataset.id;
    if (parentId) {
      root.value.change$.next({ parentId, id });
    }
  };

  onMounted(() => {
    if (!props.subChildren) {
      return;
    }

    addUnsubscribe(
      root.value.change$.subscribe(value => {
        const parentId = $div.value.parentElement?.dataset.id;

        if (parentId === value.parentId && id !== value.id) {
          state.show = false;
        }

        state.selected = id === value.parentId;
      })
    );
  });

  return () => html`
    <div
      ${ref($div)}
      class=${[styles.item, { selected: state.selected }]}
      data-id=${id}
      @mouseenter=${handleMouseenter}
      @click=${props.onClick}
    >
      ${props.children}
    </div>
    ${props.subChildren && state.show
      ? html`
          <${ContextMenuContent}
            id=${id}
            x=${state.x}
            y=${state.y}
            children=${props.subChildren}
          />
        `
      : null}
  `;
};

export default ContextMenuItem;
