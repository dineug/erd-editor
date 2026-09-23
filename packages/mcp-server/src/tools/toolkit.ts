import { DocumentInfo } from '@dineug/erd-editor-agent-hub';
import { Schema } from 'effect';
import { McpSchema, Tool, Toolkit } from 'effect/unstable/ai';

import { describeArg, describeTool } from '@/tools/copy';
import { type ActionTool, actionTools } from '@/tools/registry';
import { argsFields, toolInputSchema } from '@/tools/schema';

/** The tools the server adds beside the registry's edit tools. */
export const SESSION_TOOL_NAMES = Object.freeze([
  'erd_list_documents',
  'erd_open_document',
  'erd_read',
  'erd_list',
  'erd_get',
  'erd_save',
  'erd_undo',
  'erd_redo',
] as const);

/** Removals and whole-document imports discard what the document held. */
export function isDestructive(name: string): boolean {
  return name.startsWith('erd_remove_') || name.startsWith('erd_import_');
}

/**
 * A refused call. A struct and not an Error, so the server writes the whole
 * payload as the one text block of an isError result.
 */
export const ToolRefusal = Schema.Struct({
  error: Schema.Struct({ code: Schema.String, message: Schema.String }),
});

const Mode = Schema.Literals(['live', 'headless', 'blocked']);

/** Left out when empty, as every result does. */
const Notes = Schema.optionalKey(Schema.Array(Schema.String));

/*
 * The success schemas declare their keys in the order the results emit them:
 * the toolkit writes the encoded value, so the text block keeps the body's bytes.
 */

export const ListResult = Schema.Struct({
  mode: Mode,
  documents: Schema.Array(DocumentInfo),
  notes: Notes,
});

export const OpenResult = Schema.Struct({
  mode: Mode,
  path: Schema.String,
  created: Schema.Boolean,
  opened: Schema.Boolean,
  notes: Notes,
});

export const SaveResult = Schema.Struct({
  tool: Schema.Literal('erd_save'),
  mode: Mode,
  saved: Schema.Boolean,
  notes: Notes,
});

export const UndoResult = Schema.Struct({
  tool: Schema.Literals(['erd_undo', 'erd_redo']),
  mode: Mode,
  toolName: Schema.NullOr(Schema.String),
  entries: Schema.Int,
  skipped: Schema.optionalKey(Schema.Array(Schema.String)),
  notes: Notes,
});

export const EditResult = Schema.Struct({
  tool: Schema.String,
  mode: Mode,
  createdIds: Schema.Array(Schema.String),
  batches: Schema.Int,
  historyEntries: Schema.Int,
  undoable: Schema.optionalKey(Schema.Boolean),
  undoNote: Schema.optionalKey(Schema.String),
  mismatch: Schema.optionalKey(
    Schema.Struct({
      expectedBatches: Schema.String,
      expectedHistory: Schema.String,
    })
  ),
  notes: Notes,
});

const pathField = (tool: string) =>
  Schema.String.annotate({ description: describeArg(tool, 'path') });

/** Every handler reads the calling client's name, which only a request carries. */
const dependencies = [McpSchema.McpRequestContext];

/**
 * Takes any object and ignores its keys: a parameterless tool refuses unknown
 * keys and an empty struct advertises no object root.
 */
const ListDocuments = Tool.make('erd_list_documents', {
  description: describeTool('erd_list_documents'),
  parameters: Schema.Record(Schema.String, Schema.Unknown),
  success: ListResult,
  failure: ToolRefusal,
  dependencies,
}).annotate(Tool.Readonly, true);

/** The arguments of the session tools that take any, each path described for its tool. */
export const SessionParams = {
  erd_open_document: Schema.Struct({
    path: pathField('erd_open_document'),
    create: Schema.optionalKey(
      Schema.Boolean.annotate({
        description: describeArg('erd_open_document', 'create'),
      })
    ),
  }),
  erd_save: Schema.Struct({ path: pathField('erd_save') }),
  erd_undo: Schema.Struct({ path: pathField('erd_undo') }),
  erd_redo: Schema.Struct({ path: pathField('erd_redo') }),
};

/**
 * Lists its SessionParams struct but decodes nothing, so its handler does:
 * a malformed argument is refused with an isError result and an unknown key
 * is dropped, where the toolkit would answer -32602.
 */
const sessionTool = <
  const Name extends keyof typeof SessionParams,
  Success extends Schema.Top,
>(
  name: Name,
  success: Success
) =>
  Tool.dynamic(name, {
    description: describeTool(name),
    parameters: toolInputSchema(name, SessionParams[name], false),
    success,
    failure: ToolRefusal,
  })
    .addDependency(McpSchema.McpRequestContext)
    .annotate(Tool.Destructive, false);

/**
 * The session tools but the three read tools, which answer plain text and so
 * are added by hand. None is strict: an unknown key is ignored.
 */
export const SessionToolkit = Toolkit.make(
  ListDocuments,
  sessionTool('erd_open_document', OpenResult),
  sessionTool('erd_save', SaveResult),
  sessionTool('erd_undo', UndoResult),
  sessionTool('erd_redo', UndoResult)
);

/**
 * One registry tool, a path argument in front of its own. Strict: an unknown
 * argument is refused with JSON-RPC -32602 before a session is touched.
 */
export function toTool(tool: ActionTool) {
  if (tool.args.some(({ name }) => name === 'path')) {
    throw new Error(
      `${tool.name} has an argument named path, which every tool reserves`
    );
  }

  return Tool.make(tool.name, {
    description: describeTool(tool.name),
    parameters: Schema.Struct({
      path: pathField(tool.name),
      ...argsFields(tool.args, arg => describeArg(tool.name, arg.name)),
    }),
    success: EditResult,
    failure: ToolRefusal,
    dependencies,
  })
    .annotate(Tool.Strict, true)
    .annotate(Tool.Destructive, isDestructive(tool.name));
}

export const EditToolkit = Toolkit.make(...actionTools.map(toTool));
