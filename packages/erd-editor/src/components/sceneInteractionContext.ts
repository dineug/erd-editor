import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';

/**
 * How a scene takes a press on a table, memo or group: 'edit' selects and
 * carries it, and 'read' leaves the press to the scene root, selecting and moving
 * nothing. A read-only scene root provides 'read'; every other scene keeps 'edit'.
 */
export type SceneInteraction = 'edit' | 'read';

/**
 * What a scene root provides: its mode, or a getter of it where the mode can
 * change, since a scene that subscribes after a provider's set still gets the
 * value the provider started with.
 */
export type SceneInteractionValue = SceneInteraction | (() => SceneInteraction);

export const sceneInteractionContext =
  createContext<SceneInteractionValue>('edit');

/**
 * A getter of the mode the scene takes a press in, which reads what its root
 * provides each time it is called, so a render and a handler see the mode in force.
 */
export const useSceneInteraction = (ctx: Ctx) => {
  const provided = useContext(ctx, sceneInteractionContext);

  return (): SceneInteraction => {
    const value = provided.value;
    return typeof value === 'function' ? value() : value;
  };
};

/**
 * Whether a scene takes the wheel and the fingers over it now: always, but a
 * read-only root takes them only while it holds the focus, so a page scrolls
 * past it before then.
 */
export const sceneActiveContext = createContext<() => boolean>(() => true);

export const useSceneActive = (ctx: Ctx) => useContext(ctx, sceneActiveContext);
