import {
  type ActionTool,
  actionTools,
  READ_FORMATS,
  type ReadFormat,
  SQL_VENDORS,
} from '@dineug/erd-editor/agent.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { type SessionManager } from '@/session/manager';
import { describeArg, describeTool } from '@/tools/copy';
import {
  errorResult,
  jsonResult,
  textResult,
  toolRunResult,
  undoResult,
} from '@/tools/result';
import { argsShape } from '@/tools/schema';

/** The tools the server adds beside the registry's edit tools. */
export const SESSION_TOOL_NAMES = Object.freeze([
  'erd_list_documents',
  'erd_open_document',
  'erd_read',
  'erd_save',
  'erd_undo',
  'erd_redo',
] as const);

const READ_ONLY: ToolAnnotations = { readOnlyHint: true };
const EDIT: ToolAnnotations = { destructiveHint: false };
const DESTRUCTIVE: ToolAnnotations = { destructiveHint: true };

/** Removals and whole-document imports discard what the document held. */
export function isDestructive(name: string): boolean {
  return name.startsWith('erd_remove_') || name.startsWith('erd_import_');
}

const pathArg = (tool: string) =>
  z.string().describe(describeArg(tool, 'path'));

/** Turns a thrown refusal into an error result, so a call never fails the protocol. */
async function answer(
  task: () => Promise<CallToolResult>
): Promise<CallToolResult> {
  try {
    return await task();
  } catch (error) {
    return errorResult(error);
  }
}

/** One registry tool, a path argument in front of its own; exported for the path collision spec. */
export function registerEditTool(
  server: McpServer,
  manager: SessionManager,
  tool: ActionTool
): void {
  if (tool.args.some(({ name }) => name === 'path')) {
    throw new Error(
      `${tool.name} has an argument named path, which every tool reserves`
    );
  }

  server.registerTool(
    tool.name,
    {
      description: describeTool(tool.name),
      inputSchema: {
        path: pathArg(tool.name),
        ...argsShape(tool.args, arg => describeArg(tool.name, arg.name)),
      },
      annotations: isDestructive(tool.name) ? DESTRUCTIVE : EDIT,
    },
    ({ path, ...args }: Record<string, unknown>) =>
      answer(async () =>
        toolRunResult(
          tool,
          await manager.runTool(String(path), tool.name, args)
        )
      )
  );
}

/** Registers the six session tools and one edit tool per registry entry. */
export function registerTools(
  server: McpServer,
  manager: SessionManager
): void {
  server.registerTool(
    'erd_list_documents',
    {
      description: describeTool('erd_list_documents'),
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => answer(async () => jsonResult({ ...(await manager.listDocuments()) }))
  );

  server.registerTool(
    'erd_open_document',
    {
      description: describeTool('erd_open_document'),
      inputSchema: {
        path: pathArg('erd_open_document'),
        create: z
          .boolean()
          .optional()
          .describe(describeArg('erd_open_document', 'create')),
      },
      annotations: EDIT,
    },
    ({ path, create }) =>
      answer(async () =>
        jsonResult({ ...(await manager.openDocument(path, create === true)) })
      )
  );

  server.registerTool(
    'erd_read',
    {
      description: describeTool('erd_read'),
      inputSchema: {
        path: pathArg('erd_read'),
        format: z
          .enum(READ_FORMATS as [ReadFormat, ...ReadFormat[]])
          .describe(describeArg('erd_read', 'format')),
        vendor: z
          .enum(SQL_VENDORS as [string, ...string[]])
          .optional()
          .describe(describeArg('erd_read', 'vendor')),
      },
      annotations: READ_ONLY,
    },
    ({ path, format, vendor }) =>
      answer(async () => {
        const { text, notes } = await manager.read(path, format, vendor);
        return textResult(text, notes);
      })
  );

  server.registerTool(
    'erd_save',
    {
      description: describeTool('erd_save'),
      inputSchema: { path: pathArg('erd_save') },
      annotations: EDIT,
    },
    ({ path }) =>
      answer(async () => {
        const { saved, mode, notes } = await manager.save(path);
        return jsonResult({ tool: 'erd_save', mode, saved, notes });
      })
  );

  for (const name of ['erd_undo', 'erd_redo'] as const) {
    server.registerTool(
      name,
      {
        description: describeTool(name),
        inputSchema: { path: pathArg(name) },
        annotations: EDIT,
      },
      ({ path }) =>
        answer(async () =>
          undoResult(
            name,
            await (name === 'erd_undo'
              ? manager.undo(path)
              : manager.redo(path))
          )
        )
    );
  }

  for (const tool of actionTools) registerEditTool(server, manager, tool);
}
