import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * Which coordinate system the scene a component sits in is drawn from. Each
 * root that opens a scene provides its own inside its wrapper, so an export or
 * a minimap of the document keeps it while a Flow scene beside them reads its view.
 */
export const sceneSourceContext = createContext<GeometrySource>('document');

export const useSceneSource = (ctx: Ctx) => useContext(ctx, sceneSourceContext);
