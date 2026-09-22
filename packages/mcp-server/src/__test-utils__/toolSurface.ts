import { readFileSync } from 'node:fs';

import { expect } from 'vite-plus/test';

/** One entry of a tools/list answer, as narrow as every MCP server implementation answers it. */
export type ListedTool = {
  name: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export type ToolArgSurface = {
  name: string;
  type: string;
  required: boolean;
  enum?: string[];
  items?: { type: string };
};

export type ToolSurface = {
  name: string;
  args: ToolArgSurface[];
  hasOutputSchema: boolean;
};

const FIXTURE_URL = new URL('./toolSurface.0.1.0.json', import.meta.url);

const UNKNOWN_TYPE = 'unknown';

/** The one type name a schema advertises; an array collapses to integer when it holds one. */
function scalarType(type: unknown): string {
  if (Array.isArray(type)) {
    const declared = type.map(String);
    return declared.includes('integer') ? 'integer' : scalarType(declared[0]);
  }
  return type === undefined ? UNKNOWN_TYPE : String(type);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asNames(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function byName(left: { name: string }, right: { name: string }): number {
  if (left.name < right.name) return -1;
  return left.name > right.name ? 1 : 0;
}

function normalizeArg(
  name: string,
  schema: Record<string, unknown>,
  required: readonly string[]
): ToolArgSurface {
  const arg: ToolArgSurface = {
    name,
    type: scalarType(schema.type),
    required: required.includes(name),
  };
  if (schema.enum !== undefined) arg.enum = asNames(schema.enum).sort();
  if (schema.items !== undefined) {
    arg.items = { type: scalarType(asRecord(schema.items).type) };
  }
  return arg;
}

/**
 * The comparable part of a tools list: tool names, argument names, JSON types, required
 * flags and whether a result schema is advertised. Descriptions, $schema, $defs,
 * additionalProperties and annotations are dropped, being wording or a known dialect gap.
 */
export function normalizeToolSurface(
  tools: readonly ListedTool[]
): ToolSurface[] {
  return tools
    .map(tool => {
      const schema = asRecord(tool.inputSchema);
      const required = asNames(schema.required);
      return {
        name: tool.name,
        args: Object.entries(asRecord(schema.properties)).map(
          ([name, property]) => normalizeArg(name, asRecord(property), required)
        ),
        hasOutputSchema: tool.outputSchema !== undefined,
      };
    })
    .sort(byName);
}

/** The type a schema declares, verbatim; an array keeps its brackets so it never reads as one name. */
function declaredType(type: unknown): string {
  return Array.isArray(type)
    ? `[${type.map(String).join(', ')}]`
    : String(type);
}

/** Fails naming the tool when a listed input schema does not itself declare the object type. */
export function expectObjectInputSchemas(tools: readonly ListedTool[]): void {
  expect(
    tools.map(
      ({ name, inputSchema }) =>
        `${name}: ${declaredType(asRecord(inputSchema).type)}`
    )
  ).toEqual(tools.map(({ name }) => `${name}: object`));
}

/** The 0.1.0 surface recorded from the SDK server, the parity spec's baseline. */
export function readToolSurfaceFixture(): ToolSurface[] {
  return JSON.parse(readFileSync(FIXTURE_URL, 'utf8')) as ToolSurface[];
}
