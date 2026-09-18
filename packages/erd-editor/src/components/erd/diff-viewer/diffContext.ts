import { createContext, useContext } from '@dineug/r-html';

import type { DiffMap } from '@/components/erd/diff-viewer/diff';
import { Ctx } from '@/internal-types';

/**
 * The changes a diff pane tints its cells by. ErdViewer alone provides one, so
 * every other scene reads null and draws no tint, and no node for one either.
 */
export const diffContext = createContext<DiffMap | null>(null);

export const useDiffMap = (ctx: Ctx) => useContext(ctx, diffContext);
