import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';
import type { DiffMap } from '@/utils/diff/diff';

/**
 * The changes a diff pane tints its cells by. ErdViewer alone provides one, so
 * every other scene reads null and draws no tint, and no node for one either.
 */
export const diffContext = createContext<DiffMap | null>(null);

export const useDiffMap = (ctx: Ctx) => useContext(ctx, diffContext);
