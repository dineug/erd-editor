import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  createErdMcpServer,
  type ErdMcpServer,
  type ErdMcpServerOptions,
} from '@/server';

export type CallOutcome = {
  isError: boolean;
  /** The first text block, parsed when it is JSON. */
  json: any;
  text: string;
  /** Every text block, in order. */
  texts: string[];
};

export type McpHarness = {
  client: Client;
  erd: ErdMcpServer;
  call: (name: string, args?: Record<string, unknown>) => Promise<CallOutcome>;
  /** Like call, but fails the spec on an error result; parsed JSON when it is JSON. */
  ok: (name: string, args?: Record<string, unknown>) => Promise<any>;
  /** The raw first text block of a successful call, such as a read. */
  text: (name: string, args?: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
};

function parse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** An MCP client and the server wired through the SDK's in-memory transport. */
export async function connectMcp(
  options: ErdMcpServerOptions & { clientName?: string }
): Promise<McpHarness> {
  const erd = createErdMcpServer(options);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await erd.server.connect(serverTransport);
  const client = new Client({
    name: options.clientName ?? 'claude-code',
    version: '1.0.0',
  });
  await client.connect(clientTransport);

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;
    const texts = result.content
      .filter(block => block.type === 'text')
      .map(block => (block as { text: string }).text);
    return {
      isError: result.isError === true,
      json: parse(texts[0] ?? ''),
      text: texts[0] ?? '',
      texts,
    };
  };

  return {
    client,
    erd,
    call,
    ok: async (name, args) => {
      const outcome = await call(name, args);
      if (outcome.isError) {
        throw new Error(`${name} failed: ${outcome.text}`);
      }
      return outcome.json ?? outcome.text;
    },
    text: async (name, args) => {
      const outcome = await call(name, args);
      if (outcome.isError) {
        throw new Error(`${name} failed: ${outcome.text}`);
      }
      return outcome.text;
    },
    close: async () => {
      await client.close();
      await erd.close();
    },
  };
}

/** Lets queued microtasks and socket deliveries run. */
export const settle = (ms = 5) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** Document JSON without the per-replica meta stamps, for comparing two sides. */
export function comparable(value: string) {
  const document = JSON.parse(value);
  for (const entities of Object.values<Record<string, any>>(
    document.collections
  )) {
    for (const entity of Object.values<any>(entities)) delete entity.meta;
  }
  return document;
}
