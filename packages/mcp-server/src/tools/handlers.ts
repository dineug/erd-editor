import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as McpSchema from 'effect/unstable/ai/McpSchema';
import type * as Toolkit from 'effect/unstable/ai/Toolkit';

import { SessionManager, type SessionManagerShape } from '@/session/manager';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { type ActionTool, actionTools } from '@/tools/registry';
import {
  isRefusal,
  jsonBody,
  refusal,
  toolRunResult,
  undoResult,
} from '@/tools/result';
import { EditToolkit, SessionParams, SessionToolkit } from '@/tools/toolkit';

/**
 * Tells the session manager who calls, then runs the call. A refusal fails
 * with its code and message; anything else is logged and fails as internal.
 */
export const answer = <A, R>(
  sessions: SessionManagerShape,
  task: Effect.Effect<A, unknown, R>
) =>
  Effect.gen(function* () {
    const request = yield* McpSchema.McpRequestContext;
    yield* sessions.rememberClient(request.clientInfo?.name);
    return yield* task;
  }).pipe(
    Effect.catch(error =>
      (isRefusal(error)
        ? Effect.void
        : Effect.logError('a tool call failed', error)
      ).pipe(Effect.andThen(Effect.fail(refusal(error))))
    )
  );

type SessionToolName = keyof typeof SessionParams;

/** A session tool's arguments, decoded leniently: unknown keys dropped, a malformed one refused. */
const argumentsOf =
  <const Name extends SessionToolName>(name: Name) =>
  (payload: unknown) =>
    Schema.decodeUnknownEffect(SessionParams[name])(payload).pipe(
      Effect.mapError(
        error =>
          new ToolError(
            ToolErrorCode.invalidArgs,
            name,
            `Invalid arguments for tool ${name}: ${error.message}`
          )
      )
    );

const openArgs = argumentsOf('erd_open_document');
const pathArgs = {
  erd_save: argumentsOf('erd_save'),
  erd_undo: argumentsOf('erd_undo'),
  erd_redo: argumentsOf('erd_redo'),
};

export const SessionHandlers = SessionToolkit.toLayer(
  Effect.gen(function* () {
    const sessions = yield* SessionManager;
    const revert = (name: 'erd_undo' | 'erd_redo', payload: unknown) =>
      answer(
        sessions,
        pathArgs[name](payload).pipe(
          Effect.flatMap(({ path }) =>
            name === 'erd_undo' ? sessions.undo(path) : sessions.redo(path)
          ),
          Effect.map(outcome => undoResult(name, outcome))
        )
      );

    return {
      erd_list_documents: () =>
        answer(
          sessions,
          sessions.listDocuments.pipe(
            Effect.map(outcome => jsonBody({ ...outcome }))
          )
        ),
      erd_open_document: payload =>
        answer(
          sessions,
          openArgs(payload).pipe(
            Effect.flatMap(({ path, create }) =>
              sessions.openDocument(path, create === true)
            ),
            Effect.map(outcome => jsonBody({ ...outcome }))
          )
        ),
      erd_save: payload =>
        answer(
          sessions,
          pathArgs.erd_save(payload).pipe(
            Effect.flatMap(({ path }) => sessions.save(path)),
            Effect.map(({ saved, mode, notes }) =>
              jsonBody({ tool: 'erd_save' as const, mode, saved, notes })
            )
          )
        ),
      erd_undo: payload => revert('erd_undo', payload),
      erd_redo: payload => revert('erd_redo', payload),
    };
  })
);

type EditHandlers = Toolkit.HandlersFrom<(typeof EditToolkit)['tools']>;

/** One handler per registry tool: the path picks the session, the rest are the tool's own arguments. */
export const EditHandlers = EditToolkit.toLayer(
  Effect.gen(function* () {
    const sessions = yield* SessionManager;
    const handle =
      (tool: ActionTool) =>
      ({ path, ...args }: { readonly [key: string]: unknown }) =>
        answer(
          sessions,
          sessions
            .runTool(String(path), tool.name, args)
            .pipe(Effect.map(outcome => toolRunResult(tool, outcome)))
        );

    return Object.fromEntries(
      actionTools.map(tool => [tool.name, handle(tool)])
    ) as EditHandlers;
  })
);

/** Both toolkits' handlers, over the one session manager. */
export const ToolHandlers = Layer.mergeAll(SessionHandlers, EditHandlers);
