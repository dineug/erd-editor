import type { ToolArg, ToolArgKind } from '@dineug/erd-editor/agent.js';
import { z } from 'zod';

/**
 * The zod type of one registry argument kind. The shape only guides the
 * agent; the peer validates again, entity liveness included, before it runs.
 */
export function argKindSchema(kind: ToolArgKind): z.ZodType {
  switch (kind.type) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
    case 'enum': {
      const names = Object.keys(kind.values);
      return z.enum(names as [string, ...string[]]);
    }
    case 'entityId':
      return z.string();
    case 'entityIdList':
      return z.array(z.string());
    default: {
      const never: never = kind;
      throw new TypeError(
        `Unknown tool argument kind ${JSON.stringify(never)}`
      );
    }
  }
}

/** The input shape of a registry tool, each argument described and optional ones marked. */
export function argsShape(
  args: readonly ToolArg[],
  describe: (arg: ToolArg) => string
): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const arg of args) {
    const schema = argKindSchema(arg.kind).describe(describe(arg));
    shape[arg.name] = arg.required ? schema : schema.optional();
  }
  return shape;
}
