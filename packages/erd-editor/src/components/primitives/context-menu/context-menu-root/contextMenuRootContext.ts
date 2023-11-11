import {
  createContext,
  nextTick,
  observable,
  useContext,
  useProvider,
} from '@dineug/r-html';
import { Subject } from 'rxjs';

import { Ctx } from '@/internal-types';

export type ContextMenuRootContext = {
  show: boolean;
  x: number;
  y: number;
  change$: Subject<{
    parentId: string;
    id: string;
  }>;
};

export const contextMenuRootContext = createContext<ContextMenuRootContext>({
  show: false,
  x: 0,
  y: 0,
  change$: new Subject(),
});

export const useContextMenuRootContext = (ctx: Ctx) =>
  useContext(ctx, contextMenuRootContext);

export function useContextMenuRootProvider(ctx: Ctx) {
  const state = observable<ContextMenuRootContext>({
    show: false,
    x: 0,
    y: 0,
    change$: new Subject(),
  });

  const provider = useProvider(ctx, contextMenuRootContext, state);

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();

    state.x = event.clientX;
    state.y = event.clientY;
    state.show = false;
    nextTick(() => {
      state.show = true;
    });
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    if (!el.closest('.context-menu-content')) {
      state.show = false;
    }
  };

  return {
    provider,
    state,
    onContextmenu,
    onMousedown,
  };
}
