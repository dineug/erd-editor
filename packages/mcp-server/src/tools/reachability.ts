import type { ActionType } from '@dineug/erd-editor/peer.js';

/** Change types no tool emits. Every other change type has a tool that can. */
export const NOT_EMITTED: ReadonlyArray<ActionType> = Object.freeze([
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
  'settings.changeCanvasType',
  'table.move',
  'memo.move',
]);

/** Change types a tool emits only inside another op's batch, never on their own. */
export const NO_DEDICATED_TOOL: ReadonlyArray<ActionType> = Object.freeze([
  'editor.clear',
]);

/** Why each type above has no tool of its own, keyed by exactly those types. */
export const EXCLUSION_REASONS: Readonly<Partial<Record<ActionType, string>>> =
  Object.freeze({
    'settings.scrollTo':
      'The viewport belongs to whoever looks at the canvas; an agent never pans it.',
    'settings.streamScrollTo':
      'The streamed twin of a pan, which an agent never makes.',
    'settings.changeZoomLevel':
      'The zoom belongs to whoever looks at the canvas; an agent never zooms it.',
    'settings.streamZoomLevel':
      'The streamed twin of a zoom, which an agent never makes.',
    'settings.changeCanvasType':
      'The canvas type belongs to whoever looks at the canvas: the shared store tags it following and every receiver drops it, so an agent change would reach no one else.',
    'table.move':
      'A relative drag step; table.moveTo places a table where the agent names.',
    'memo.move':
      'A relative drag step; memo.moveTo places a memo where the agent names.',
    'editor.clear':
      'Emitted by the import tools, which clear the document before loading the new one.',
  });

/**
 * Change types that should have a tool and do not have one. The reachability
 * spec reads it alongside the tools; every op is covered, so it stays empty,
 * and a type the engine adds without a tool must be named here or fail it.
 */
export const PENDING_COVERAGE: readonly ActionType[] = Object.freeze([]);
