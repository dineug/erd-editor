/**
 * The presence an editor sends of its cursor, focus, selection and marquee.
 * Awareness carries the last of each, so none of them reaches the log.
 */
export const TRACKER_TYPES = [
  'editor.sharedMouseTracker',
  'editor.sharedFocusTracker',
  'editor.sharedSelectionTracker',
  'editor.sharedDragSelectTracker',
] as const;

/**
 * The register handshake a joiner asks with and a peer answers with. A
 * snapshot carries the registers and the version instead, so neither is logged.
 */
export const HANDSHAKE_TYPES = ['editor.getLWW', 'editor.mergeLWW'] as const;

/**
 * The viewport and the tab, which a follower of another's screen would read.
 * Each reader keeps its own, so they stay out of the log; the name view is logged.
 */
export const FOLLOWING_TYPES = [
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
  'settings.changeCanvasType',
] as const;

const trackers = new Set<string>(TRACKER_TYPES);
const handshake = new Set<string>(HANDSHAKE_TYPES);
const following = new Set<string>(FOLLOWING_TYPES);

export const isTracker = (type: string): boolean => trackers.has(type);

export const isHandshake = (type: string): boolean => handshake.has(type);

export const isFollowing = (type: string): boolean => following.has(type);

/** A document change every peer and replica applies: what an outbound batch holds besides the eleven above. */
export const isLogged = (type: string): boolean =>
  !isTracker(type) && !isHandshake(type) && !isFollowing(type);
