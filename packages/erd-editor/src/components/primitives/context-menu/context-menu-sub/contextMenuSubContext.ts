import { createContext, useContext } from '@dineug/r-html';

export type ContextMenuSubContext = {
  init: boolean;
  show: boolean;
  x: number;
  y: number;
  lastHoveredId: string | null;
  triggerId: string | null;
  onMouseover: (event: MouseEvent, id: string) => void;
  setHoveredId: (id: string) => void;
};

export const contextMenuSubContext = createContext<ContextMenuSubContext>({
  init: true,
  show: false,
  x: 0,
  y: 0,
  lastHoveredId: null,
  triggerId: null,
  onMouseover: () => {},
  setHoveredId: () => {},
});

export const useContextMenuSubContext = (
  ctx: Parameters<typeof useContext>[0]
) => useContext(ctx, contextMenuSubContext);
