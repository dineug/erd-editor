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
