import type * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type * as Stdio from 'effect/Stdio';
import * as McpProtocol from 'effect/unstable/ai/McpProtocol';
import * as McpServer from 'effect/unstable/ai/McpServer';

import { StderrLogger } from '@/logger';
import * as Sessions from '@/session/service';
import { MessageStdin } from '@/stdin';
import { SERVER_INSTRUCTIONS } from '@/tools/copy';
import { ToolHandlers } from '@/tools/handlers';
import { registerReadTool } from '@/tools/read.tool';
import { EditToolkit, SessionToolkit } from '@/tools/toolkit';

export const SERVER_NAME = 'erd-editor';

/** Pinned to package.json by server.test.ts. */
export const SERVER_VERSION = '0.1.0';

/** The nickname a peer shows when the client sent no name. */
export const DEFAULT_CLIENT_NAME = 'agent';

/** How often idle sessions are looked for between calls. */
export const SWEEP_INTERVAL_MS = 60_000;

/**
 * The three dated protocols that answer a malformed tool argument with
 * JSON-RPC -32602; the newer ones answer it with an isError result instead.
 */
export const PROTOCOLS = [
  McpProtocol.v2025_06_18,
  McpProtocol.v2025_03_26,
  McpProtocol.v2024_11_05,
] as const;

/**
 * Every tool, registered one after another so tools/list keeps one order:
 * Layer.mergeAll would build the three concurrently and interleave them.
 */
export const ToolsLayer: Layer.Layer<
  never,
  never,
  McpServer.McpServer | Sessions.SessionManager
> = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* McpServer.registerToolkit(SessionToolkit);
    yield* registerReadTool;
    yield* McpServer.registerToolkit(EditToolkit);
  })
).pipe(Layer.provide(ToolHandlers));

export type ServerOptions = Omit<
  Sessions.SessionManagerOptions,
  'sweepIntervalMs' | 'defaultClientName'
> & { sweepIntervalMs?: number };

/**
 * The MCP server over stdio on the sessions a layer gives. layerStdio
 * interrupts the fiber that builds it when stdin ends, so it is provided
 * around the registrations and never merged beside them; it reads MessageStdin.
 */
export const layerWithSessions = <E>(
  sessions: Layer.Layer<Sessions.SessionManager, E>
): Layer.Layer<
  Sessions.SessionManager,
  E | Cause.IllegalArgumentError,
  Stdio.Stdio
> =>
  ToolsLayer.pipe(
    Layer.provide(
      McpServer.layerStdio({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        instructions: SERVER_INSTRUCTIONS,
        protocols: PROTOCOLS,
      }).pipe(Layer.provide(MessageStdin))
    ),
    Layer.provideMerge(sessions),
    Layer.provide(StderrLogger)
  );

/** The server with the session manager beside it, which the end of stdin closes. */
export const makeServerLayer = (options: ServerOptions = {}) =>
  layerWithSessions(
    Sessions.layer({
      ...options,
      sweepIntervalMs: options.sweepIntervalMs ?? SWEEP_INTERVAL_MS,
      defaultClientName: DEFAULT_CLIENT_NAME,
    })
  );

export const ServerLayer = makeServerLayer();
