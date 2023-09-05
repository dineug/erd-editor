import {
  DOMTemplateLiterals,
  FC,
  observable,
  onBeforeMount,
  onUnmounted,
  useProvider,
  watch,
} from '@dineug/r-html';

import { useContextMenuRootContext } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';

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

      const { width, x, y } = el.getBoundingClientRect();
      state.x = width + x;
      state.y = y - 8;
      state.triggerId = id;
      state.show = true;
    },
    setHoveredId: (id: string) => {
      state.lastHoveredId = id;
    },
  });

  let provider: ReturnType<typeof useProvider<ContextMenuSubContext>> | null =
    null;

  onBeforeMount(() => {
    provider = useProvider(ctx, contextMenuSubContext, state);
  });
  onUnmounted(() => {
    provider?.destroy();
    provider = null;
  });

  const unsubscribeSet = new Set<() => void>();

  onBeforeMount(() => {
    if (isSub) {
      unsubscribeSet.add(
        watch(root.value).subscribe(name => {
          if (name !== 'lastHoveredId') return;

          if (state.triggerId !== root.value.lastHoveredId) {
            state.show = false;
          }
        })
      );
    } else {
      unsubscribeSet.add(
        watch(sub.value).subscribe(name => {
          if (name !== 'lastHoveredId') return;

          if (state.triggerId !== sub.value.lastHoveredId) {
            state.show = false;
          }
        })
      );
    }
  });
  onUnmounted(() => {
    for (const unsubscribe of unsubscribeSet) {
      unsubscribe();
    }
    unsubscribeSet.clear();
  });

  return () => props.children;
};

export default ContextMenuSub;
