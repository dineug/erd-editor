import type { ReplicaEngineContext } from '@/engine/context';
import { isRemoteWrite } from '@/engine/modules/settings/screenBaseline';

/** The register of a table's, a memo's or a group's x and y, both as one. */
export const POSITION_REGISTER = 'ui.position';

/** The register of a memo's or a group's width and height, both as one. */
export const SIZE_REGISTER = 'ui.size';

/** The id the viewport's registers stand under, as the code settings' stand under settings.code. */
export const VIEWPORT_REGISTER = 'settings.viewport';

/** The viewport's two registers: the origin, both axes as one, and the zoom. */
export const ViewportRegister = {
  origin: 'origin',
  zoomLevel: 'zoomLevel',
} as const;

/**
 * Whether a step of a drag or a pan is the store's own, which adds through its
 * register. A peer's, which an editor built before the registers sends with no
 * version, each hearer stamping its own, adds outside it, as all a replica takes do.
 */
export const isOwnStep = (
  context: ReplicaEngineContext,
  tags?: number
): boolean => !context.remote && !isRemoteWrite(tags);
