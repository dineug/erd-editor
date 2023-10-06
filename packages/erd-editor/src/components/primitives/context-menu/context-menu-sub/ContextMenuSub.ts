import {
  DOMTemplateLiterals,
  FC,
  observable,
  onBeforeMount,
  useProvider,
  watch,
} from '@dineug/r-html';

import { useContextMenuRootContext } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { useUnmounted } from '@/hooks/useUnmounted';

import {
  ContextMenuSubContext,
  contextMenuSubContext,
  useContextMenuSubContext,
} from './contextMenuSubContext';

export type ContextMenuSubProps = {
  children?: DOMTemplateLiterals;
};

const ContextMenuSub: FC<ContextMenuSubProps> = (props, ctx) => {
  const root = useContextMenuRootContext(ctx);
  const sub = useContextMenuSubContext(ctx);
  const isSub = sub.value.init;
  const { addUnsubscribe } = useUnmounted();

  const state = observable<ContextMenuSubContext>({
    init: false,
    show: false,
    x: 0,
    y: 0,
    lastHoveredId: null,
    triggerId: null,
    onMouseover: (event: MouseEvent, id: string) => {
      const el = event.target as HTMLElement | null;
      if (!el) return;

      const trigger = el.closest(
        '.context-menu-sub-trigger'
      ) as HTMLElement | null;
      if (!trigger) return;

      const { width, x, y } = trigger.getBoundingClientRect();
      state.x = width + x;
      state.y = y - 8;
      state.triggerId = id;
      state.show = true;
    },
    setHoveredId: (id: string) => {
      state.lastHoveredId = id;
    },
  });

  onBeforeMount(() => {
    const provider = useProvider(ctx, contextMenuSubContext, state);

    addUnsubscribe(
      provider.destroy,
      watch(root.value).subscribe(name => {
        if (name !== 'lastHoveredId') return;

        if (state.triggerId !== root.value.lastHoveredId) {
          state.show = false;
        }
      })
    );

    if (!isSub) {
      addUnsubscribe(
        watch(sub.value).subscribe(name => {
          if (name !== 'lastHoveredId') return;

          if (state.triggerId !== sub.value.lastHoveredId) {
            state.show = false;
          }
        })
      );
    }
  });

  return () => props.children;
};

export default ContextMenuSub;
