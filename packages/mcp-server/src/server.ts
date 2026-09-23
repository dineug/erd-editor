import * as NodePath from '@effect/platform-node/NodePath';
import type { Cause, FileSystem, Path, Stdio } from 'effect';
import { Effect, Layer } from 'effect';
import { McpProtocol, McpServer } from 'effect/unstable/ai';

import * as HubConnector from '@/hub/client';
import * as HubDiscovery from '@/hub/discovery';
import * as NodeFs from '@/io/fileSystem';
import * as ProcessInfo from '@/io/process';
import { StderrLogger } from '@/logger';
import * as Sessions from '@/session/manager';
import { MessageStdin } from '@/stdin';
import { SERVER_INSTRUCTIONS } from '@/tools/copy';
import { ToolHandlers } from '@/tools/handlers';
import { registerReadTools } from '@/tools/read.tool';
import { EditToolkit, SessionToolkit } from '@/tools/toolkit';

import { version } from '../package.json';

export const SERVER_NAME = 'erd-editor';

/** The manifest's version, inlined by the build, so a release edits one file. */
export const SERVER_VERSION: string = version;

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
    // A finalizer here runs before the server waits for the calls in flight,
    // which run to their end: closing every session first ends them.
    const sessions = yield* Sessions.SessionManager;
    yield* Effect.addFinalizer(() => sessions.closeAll);

    // A call arrives as the server starts it, before a toolkit forks its
    // handler off, so the read tools, which have none, cannot overtake the others.
    const server = yield* McpServer.McpServer;
    const inArrivalOrder = Effect.provideService(
      McpServer.McpServer,
      McpServer.McpServer.of({
        ...server,
        addTool: tool =>
          server.addTool({
            ...tool,
            handle: payload => sessions.arrive(tool.handle(payload)),
          }),
      })
    );
    yield* McpServer.registerToolkit(SessionToolkit).pipe(inArrivalOrder);
    yield* registerReadTools.pipe(inArrivalOrder);
    yield* McpServer.registerToolkit(EditToolkit).pipe(inArrivalOrder);
  })
).pipe(Layer.provide(ToolHandlers));

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

/** What the sessions stand on: files, paths, the process and the way to a hub. */
export type Platform =
  | FileSystem.FileSystem
  | NodeFs.FileStats
  | Path.Path
  | ProcessInfo.ProcessInfo
  | HubConnector.HubConnector;

/**
 * The node platform: its file system (realPath and stat the native ones) and
 * path, this process, node:net connections.
 */
export const NodePlatform: Layer.Layer<Platform> = Layer.mergeAll(
  NodeFs.layer,
  NodePath.layer,
  ProcessInfo.layer,
  HubConnector.layer
);

/** The server with the session manager beside it, which the end of stdin closes. */
export const makeServerLayer = <E>(platform: Layer.Layer<Platform, E>) =>
  layerWithSessions(
    Sessions.layer.pipe(
      Layer.provide(HubDiscovery.layer),
      Layer.provide(platform)
    )
  );

export const ServerLayer = makeServerLayer(NodePlatform);
