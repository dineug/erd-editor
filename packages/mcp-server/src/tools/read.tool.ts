import { Cause, Context, Effect, Schema } from 'effect';
import { McpSchema, McpServer } from 'effect/unstable/ai';

import { SessionManager } from '@/session/manager';
import { describeArg, describeTool } from '@/tools/copy';
import { answer } from '@/tools/handlers';
import { documentReader, READ_FORMATS, SQL_VENDORS } from '@/tools/read';
import { errorResult, textResult } from '@/tools/result';
import { toolInputSchema } from '@/tools/schema';

const READ_TOOL = 'erd_read';

export const ReadParams = Schema.Struct({
  path: Schema.String.annotate({ description: describeArg(READ_TOOL, 'path') }),
  format: Schema.Literals(READ_FORMATS).annotate({
    description: describeArg(READ_TOOL, 'format'),
  }),
  vendor: Schema.optionalKey(
    Schema.Literals(SQL_VENDORS).annotate({
      description: describeArg(READ_TOOL, 'vendor'),
    })
  ),
});

const decodeRead = Schema.decodeUnknownEffect(ReadParams, {
  onExcessProperty: 'error',
});

const INTERNAL_MESSAGE =
  'Tool execution failed due to an internal server error.';

/**
 * erd_read answers the document as plain text, not a JSON body, so it is added
 * by hand: arguments decode strictly to -32602, a refusal becomes an isError
 * result, and only a defect becomes an internal error.
 */
export const registerReadTool = Effect.gen(function* () {
  const server = yield* McpServer.McpServer;
  const sessions = yield* SessionManager;

  yield* server.addTool({
    tool: new McpSchema.Tool({
      name: READ_TOOL,
      description: describeTool(READ_TOOL),
      inputSchema: toolInputSchema(READ_TOOL, ReadParams, true),
      annotations: { readOnlyHint: true },
    }),
    annotations: Context.empty(),
    handle: payload =>
      decodeRead(payload).pipe(
        Effect.mapError(
          error =>
            new McpSchema.InvalidParams({
              message: `Invalid parameters for tool '${READ_TOOL}': ${error.message}`,
            })
        ),
        Effect.flatMap(({ path, format, vendor }) =>
          answer(
            sessions,
            sessions
              .read(path, documentReader(format, vendor))
              .pipe(Effect.map(({ text, notes }) => textResult(text, notes)))
          ).pipe(Effect.catch(refused => Effect.succeed(errorResult(refused))))
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
