import type { ActionType } from '@dineug/erd-editor/peer.js';

/** Change types no tool emits. Every other change type has a tool that can. */
export const NOT_EMITTED: ReadonlyArray<ActionType> = Object.freeze([
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
  'settings.changeCanvasType',
  'settings.changeShow',
  'settings.changeColumnOrder',
  'settings.changeMaxWidthComment',
  'settings.changeRelationshipDataTypeSync',
  'settings.changeLanguage',
  'settings.changeTableNameCase',
  'settings.changeColumnNameCase',
  'settings.changeBracketType',
  'settings.changeLockSettings',
  'memo.move',
  'tableGroup.moveTo',
  'relationship.changeColumns',
]);

/** Change types a tool emits only inside another op's batch, never on their own. */
export const NO_DEDICATED_TOOL: ReadonlyArray<ActionType> = Object.freeze([
  'editor.clear',
]);

const SCREEN =
  'How the diagram is drawn is the user’s to choose in the editor; an agent edits the schema and reads this setting in erd_list.';

const CODE =
  'How generated code is written is the user’s to choose in the editor, and its lock is theirs too; an agent reads the value the file saves in erd_list.';

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
    'settings.changeShow': SCREEN,
    'settings.changeColumnOrder': SCREEN,
    'settings.changeMaxWidthComment': SCREEN,
    'settings.changeRelationshipDataTypeSync':
      'Whether a data type change spreads along relationships is an editing habit of the user’s; an agent reads it in erd_list and sets each column it means to change.',
    'settings.changeLanguage': CODE,
    'settings.changeTableNameCase': CODE,
    'settings.changeColumnNameCase': CODE,
    'settings.changeBracketType': CODE,
    'settings.changeLockSettings':
      'A lock keeps a setting of the user’s as they saved it, so the user takes or releases one in the editor Settings tab; an agent changes locks only by loading a whole document with erd_import_json, which takes the locks it carries, every one on when it carries none, or by undoing an import.',
    'memo.move':
      'A relative drag step; memo.moveTo places a memo where the agent names.',
    'tableGroup.moveTo':
      'Places a group alone and leaves its tables behind, which no editor gesture does; erd_move_table_group moves a group and its tables by one relative step, as a drag of its title bar does.',
    'relationship.changeColumns':
      "The editor's Map Columns dialog emits it; an agent re-maps a relationship with erd_batch of erd_remove_relationship and erd_link_columns, which every editor applies.",
    'editor.clear':
      'Emitted by the import tools, which clear the document before loading the new one.',
  });

/**
 * Change types that should have a tool and do not have one yet. The
 * reachability spec reads it alongside the tools, and a type the engine adds
 * without a tool must be named here or fail it.
 */
export const PENDING_COVERAGE: readonly ActionType[] = Object.freeze([]);
