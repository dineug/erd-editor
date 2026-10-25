import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';

/**
 * How a scene takes a press on a table, memo or group: 'edit' selects and
 * carries it, and 'read' leaves the press to the scene root, selecting and moving
 * nothing. A read-only scene root provides 'read'; every other scene keeps 'edit'.
 */
export type SceneInteraction = 'edit' | 'read';

export const sceneInteractionContext = createContext<SceneInteraction>('edit');

export const useSceneInteraction = (ctx: Ctx) =>
  useContext(ctx, sceneInteractionContext);

/**
 * Whether a scene takes the wheel and the fingers over it now: always, but a
 * read-only root takes them only while it holds the focus, so a page scrolls
 * past it before then.
 */
export const sceneActiveContext = createContext<() => boolean>(() => true);

export const useSceneActive = (ctx: Ctx) => useContext(ctx, sceneActiveContext);
