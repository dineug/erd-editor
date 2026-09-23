import { Cause, Context, Effect, Schema } from 'effect';
import { McpSchema, McpServer } from 'effect/unstable/ai';

import { SessionManager } from '@/session/manager';
import { describeArg, describeTool } from '@/tools/copy';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { answer } from '@/tools/handlers';
import type { EntityIds } from '@/tools/outline';
import {
  type DocumentReader,
  documentReader,
  entityReader,
  GET_TOOL,
  LIST_TOOL,
  listReader,
  READ_FORMATS,
  READ_TOOL,
  SQL_VENDORS,
} from '@/tools/read';
import { errorResult, textResult } from '@/tools/result';
import { toolInputSchema } from '@/tools/schema';

const pathField = (tool: string) =>
  Schema.String.annotate({ description: describeArg(tool, 'path') });

export const ReadParams = Schema.Struct({
  path: pathField(READ_TOOL),
  format: Schema.Literals(READ_FORMATS).annotate({
    description: describeArg(READ_TOOL, 'format'),
  }),
  vendor: Schema.optionalKey(
    Schema.Literals(SQL_VENDORS).annotate({
      description: describeArg(READ_TOOL, 'vendor'),
    })
  ),
});

export const ListParams = Schema.Struct({ path: pathField(LIST_TOOL) });

/** The id kinds erd_get takes, each an argument of its own. */
export const ENTITY_ID_ARGS = Object.freeze([
  'tableIds',
  'relationshipIds',
  'indexIds',
  'memoIds',
] as const);

const idsField = (name: (typeof ENTITY_ID_ARGS)[number]) =>
  Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description: describeArg(GET_TOOL, name),
    })
  );

export const GetParams = Schema.Struct({
  path: pathField(GET_TOOL),
  tableIds: idsField('tableIds'),
  relationshipIds: idsField('relationshipIds'),
  indexIds: idsField('indexIds'),
  memoIds: idsField('memoIds'),
});

/** erd_get needs one id at least, in any of its lists. */
function toEntityReader(
  ids: EntityIds
): Effect.Effect<DocumentReader, ToolError> {
  return ENTITY_ID_ARGS.some(name => ids[name]?.length)
    ? Effect.succeed(entityReader(ids))
    : Effect.fail(
        new ToolError(
          ToolErrorCode.invalidArgs,
          GET_TOOL,
          `name at least one id in ${ENTITY_ID_ARGS.join(', ')}; erd_list lists them`
        )
      );
}

const INTERNAL_MESSAGE =
  'Tool execution failed due to an internal server error.';

/**
 * Adds one read tool, which answers the document as plain text, not a JSON
 * body, so it is added by hand: arguments decode strictly to -32602, a refusal
 * becomes an isError result, and only a defect becomes an internal error.
 */
const addReadTool = <
  S extends Schema.Top & {
    readonly Type: { readonly path: string };
    readonly DecodingServices: never;
  },
>(
  name: string,
  parameters: S,
  toReader: (params: S['Type']) => Effect.Effect<DocumentReader, ToolError>
) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const sessions = yield* SessionManager;
    const decode = Schema.decodeUnknownEffect(parameters, {
      onExcessProperty: 'error',
    });

    yield* server.addTool({
      tool: new McpSchema.Tool({
        name,
        description: describeTool(name),
        inputSchema: toolInputSchema(name, parameters, true),
        annotations: { readOnlyHint: true },
      }),
      annotations: Context.empty(),
      handle: payload =>
        decode(payload).pipe(
          Effect.mapError(
            error =>
              new McpSchema.InvalidParams({
                message: `Invalid parameters for tool '${name}': ${error.message}`,
              })
          ),
          Effect.flatMap(params =>
            answer(
              sessions,
              toReader(params).pipe(
                Effect.flatMap(reader => sessions.read(params.path, reader)),
                Effect.map(({ text, notes }) => textResult(text, notes))
              )
            ).pipe(
              Effect.catch(refused => Effect.succeed(errorResult(refused)))
            )
          ),
          Effect.catchDefect(defect =>
            Effect.logError('a tool call failed', Cause.die(defect)).pipe(
              Effect.andThen(
                Effect.fail(
                  new McpSchema.InternalError({ message: INTERNAL_MESSAGE })
                )
              )
            )
          )
        ),
    });
  });

/** erd_read, erd_list and erd_get, in that order. */
export const registerReadTools = Effect.gen(function* () {
  yield* addReadTool(READ_TOOL, ReadParams, ({ format, vendor }) =>
    Effect.succeed(documentReader(format, vendor))
  );
  yield* addReadTool(LIST_TOOL, ListParams, () => Effect.succeed(listReader));
  yield* addReadTool(GET_TOOL, GetParams, toEntityReader);
});
