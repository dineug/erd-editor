import type { Readable, Writable } from 'node:stream';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { type McpIo, nodeIo } from '@/io';
import { log } from '@/log';
import { createSessionManager, type SessionManager } from '@/session/manager';
import { SERVER_INSTRUCTIONS } from '@/tools/copy';
import { registerTools } from '@/tools/register';

export const SERVER_NAME = 'erd-editor';

/** Pinned to package.json by server.test.ts. */
export const SERVER_VERSION = '0.1.0';

/** The nickname a peer shows when the client sent no name. */
export const DEFAULT_CLIENT_NAME = 'agent';

/** How often idle sessions are looked for between calls. */
export const SWEEP_INTERVAL_MS = 60_000;

export type ErdMcpServer = {
  server: McpServer;
  manager: SessionManager;
  /** Closes every session, then the MCP server; safe to call twice. */
  close: () => Promise<void>;
};

export type ErdMcpServerOptions = {
  io?: McpIo;
  now?: () => number;
  idleTtlMs?: number;
  requestTimeoutMs?: number;
};

/** The MCP server with every tool registered, not yet connected to a transport. */
export function createErdMcpServer(
  options: ErdMcpServerOptions = {}
): ErdMcpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS }
  );
  const manager = createSessionManager({
    io: options.io ?? nodeIo,
    now: options.now,
    idleTtlMs: options.idleTtlMs,
    requestTimeoutMs: options.requestTimeoutMs,
    clientName: () =>
      server.server.getClientVersion()?.name || DEFAULT_CLIENT_NAME,
  });
  registerTools(server, manager);

  let closing: Promise<void> | null = null;
  return {
    server,
    manager,
    close: () =>
      (closing ??= (async () => {
        await manager.closeAll();
        await server.close();
      })()),
  };
}

export type StdioServerOptions = ErdMcpServerOptions & {
  stdin?: Readable;
  stdout?: Writable;
  sweepIntervalMs?: number;
};

/**
 * Serves MCP over stdin and stdout. The end of stdin is the client going
 * away: every session closes and nothing is left to keep the process up.
 */
export async function startStdioServer(
  options: StdioServerOptions = {}
): Promise<ErdMcpServer> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const erd = createErdMcpServer(options);

  const timer = setInterval(() => {
    erd.manager.sweep().catch(error => log('idle sweep failed', error));
  }, options.sweepIntervalMs ?? SWEEP_INTERVAL_MS);
  timer.unref();

  const close = () => {
    clearInterval(timer);
    return erd.close();
  };
  stdin.once('end', () => {
    close().catch(error => log('shutdown failed', error));
  });

  await erd.server.connect(new StdioServerTransport(stdin, stdout));
  return { ...erd, close };
}
