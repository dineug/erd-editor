import { Schema } from 'effect';
import { McpSchema } from 'effect/unstable/ai';

import type { ToolArg, ToolArgKind } from '@/tools/registry';

/**
 * The schema of one registry argument kind. The shape only guides the agent;
 * the peer validates again, entity liveness included, before it runs. Finite
 * and Int advertise a plain number and integer type, never NaN or Infinity.
 */
export function argKindSchema(kind: ToolArgKind): Schema.Top {
  switch (kind.type) {
    case 'string':
      return Schema.String;
    case 'number':
      return Schema.Finite;
    case 'integer':
      return Schema.Int;
    case 'boolean':
      return Schema.Boolean;
    case 'enum':
      return Schema.Literals(Object.keys(kind.values));
    case 'entityId':
      return Schema.String;
    case 'entityIdList':
      return Schema.Array(Schema.String);
    default: {
      const never: never = kind;
      throw new TypeError(
        `Unknown tool argument kind ${JSON.stringify(never)}`
      );
    }
  }
}

/**
 * The struct fields of a registry tool's arguments, each described, optional
 * ones as optional keys. Every field is a schema of its own, so the listed
 * input schema stays inline with no $defs.
 */
export function argsFields(
  args: readonly ToolArg[],
  describe: (arg: ToolArg) => string
): Record<string, Schema.Top> {
  const fields: Record<string, Schema.Top> = {};
  for (const arg of args) {
    const schema = argKindSchema(arg.kind).annotate({
      description: describe(arg),
    });
    fields[arg.name] = arg.required ? schema : Schema.optionalKey(schema);
  }
  return fields;
}

/**
 * The input schema a tool lists from a struct the toolkit does not decode,
 * closed by additionalProperties false when strict. MCP needs one inline
 * object, which the tool constructor would only reject, so this names the tool.
 */
export function toolInputSchema(
  name: string,
  parameters: Schema.Top,
  strict: boolean
): McpSchema.ToolJson {
  const { schema, definitions } = Schema.toJsonSchemaDocument(parameters, {
    onExcessProperty: strict ? 'error' : 'ignore',
  });
  if (schema.type !== 'object' || Object.keys(definitions).length > 0) {
    throw new TypeError(`${name} must take one inline object of arguments`);
  }
  return Schema.decodeUnknownSync(McpSchema.ToolJson)(schema);
}
