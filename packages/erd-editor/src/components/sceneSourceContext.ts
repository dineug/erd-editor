import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * Which coordinate system the scene a component sits in is drawn from. Each
 * root that opens a scene provides its own inside its wrapper, so the ERD
 * under a view overlay keeps the document while the overlay reads the view.
 */
export const sceneSourceContext = createContext<GeometrySource>('document');

export const useSceneSource = (ctx: Ctx) => useContext(ctx, sceneSourceContext);
