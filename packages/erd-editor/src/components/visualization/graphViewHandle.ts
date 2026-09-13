import { observable } from '@dineug/r-html';

import type { VisualizationNode } from './createVisualization';
import {
  createVisualizationState,
  type VisualizationState,
  type VisualizationView,
} from './visualizationView';

/** What the graph lets the bar beside it reach: the view it draws with, and where its dots stand. */
export type GraphViewHandle = {
  state: VisualizationState;
  nodes: () => VisualizationNode[];
};

/**
 * Bumped as a graph registers or lets go, keyed by editor id, so a reader that
 * asked before the mount is redrawn with the handle the mount brought. The
 * view inside the handle is observable itself, which is what carries a zoom to the same reader.
 */
const registrations = observable({ version: {} as Record<string, number> });

/**
 * The handle each graph registered, beside the observable rather than inside
 * it: the proxy would wrap the view on the way out, and a wrapped copy is not
 * the object the graph writes its zoom into.
 */
const handles = new Map<string, GraphViewHandle>();

/**
 * What a reader gets before any graph has mounted, and what nothing writes
 * into: a view at rest showing no dots. The bar renders ahead of the graph's
 * own mount, and an undefined here would leave its readout blank for a frame.
 */
const RESTING: GraphViewHandle = {
  state: createVisualizationState(0, 0),
  nodes: () => [],
};

/** Hands the graph of the editor given to whatever reads it, for as long as it is mounted. */
export function registerGraphView(
  editorId: string,
  handle: GraphViewHandle
): void {
  handles.set(editorId, handle);
  registrations.version[editorId] = (registrations.version[editorId] ?? 0) + 1;
}

/**
 * Takes the handle back as the graph unmounts. Only its own: a second graph
 * that registered in between owns the slot, and this must not empty it.
 */
export function unregisterGraphView(
  editorId: string,
  handle: GraphViewHandle
): void {
  if (handles.get(editorId) !== handle) return;

  handles.delete(editorId);
  // The key goes with the signal, or a host that mounts an editor per document
  // and drops it again leaves one entry behind for every editor it ever opened.
  delete registrations.version[editorId];
}

/**
 * The graph of the editor given, or the resting handle while none is mounted.
 * The version is read rather than merely counted, so a render that reached
 * this is redrawn once a graph registers.
 *
 * @example
 * const { state, nodes } = getGraphView(store.state.editor.id);
 */
export function getGraphView(editorId: string): GraphViewHandle {
  void registrations.version[editorId];

  return handles.get(editorId) ?? RESTING;
}

/**
 * Moves the view of the graph of the editor given, and does nothing at all
 * while none is mounted. The resting handle is one object every editor shares,
 * so a press before the mount must not be written into it.
 *
 * @example
 * updateGraphView(editor.id, ({ state }) => zoomAt(state, center, 1.04));
 */
export function updateGraphView(
  editorId: string,
  next: (handle: GraphViewHandle) => VisualizationView | null
): void {
  const handle = handles.get(editorId);
  if (!handle) return;

  const view = next(handle);
  if (view) Object.assign(handle.state, view);
}
