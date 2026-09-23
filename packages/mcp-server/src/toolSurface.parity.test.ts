import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import {
  expectObjectInputSchemas,
  type ListedTool,
  normalizeToolSurface,
  readToolSurfaceFixture,
  type ToolSurface,
} from '@/__test-utils__/toolSurface';

const fixture = readToolSurfaceFixture();

/**
 * The one tool that advertises no result schema: erd_read answers plain text,
 * added by hand. The 58 toolkit tools declare theirs; the recording has none.
 */
const PLAIN_TEXT_TOOLS: ReadonlySet<string> = new Set(['erd_read']);

let mcp: McpHarness;
let tools: ListedTool[];
let live: ToolSurface[];

beforeAll(async () => {
  mcp = await connectMcp({ host: createMemoryHost() });
  tools = (await mcp.listTools()).tools;
  live = normalizeToolSurface(tools);
});

afterAll(async () => {
  await mcp.close();
});

const declarations = (surface: readonly ToolSurface[]) =>
  surface.map(({ name, args }) => ({ name, args }));

const outputSchemas = (surface: readonly ToolSurface[]) =>
  surface.map(({ name, hasOutputSchema }) => ({ name, hasOutputSchema }));

describe('the tool surface against the SDK-based server recording', () => {
  it('holds the 59 recorded tools', () => {
    expect(fixture).toHaveLength(59);
    expect(tools).toHaveLength(59);
  });

  it('keeps every tool name, argument name, JSON type and required flag', () => {
    expect(declarations(live)).toEqual(declarations(fixture));
  });

  it('advertises a result schema for every tool but erd_read, where the recording has none', () => {
    expect(outputSchemas(fixture).every(tool => !tool.hasOutputSchema)).toBe(
      true
    );
    expect(outputSchemas(live)).toEqual(
      fixture.map(({ name }) => ({
        name,
        hasOutputSchema: !PLAIN_TEXT_TOOLS.has(name),
      }))
    );
    expect(live.filter(tool => tool.hasOutputSchema)).toHaveLength(58);
  });

  it('takes an object for its arguments, in every tool', () => {
    expectObjectInputSchemas(tools);
  });
});

const listed = (
  name: string,
  inputSchema: Record<string, unknown>,
  outputSchema?: Record<string, unknown>
): ListedTool => ({ name, inputSchema, outputSchema });

const object = (
  properties: Record<string, unknown>,
  required?: string[]
): Record<string, unknown> =>
  required === undefined
    ? { type: 'object', properties }
    : { type: 'object', properties, required };

describe('normalizeToolSurface', () => {
  it('sorts the tools by name', () => {
    const surface = normalizeToolSurface([
      listed('b', object({})),
      listed('a', object({})),
    ]);

    expect(surface.map(({ name }) => name)).toEqual(['a', 'b']);
  });

  it('reads a schema with no properties and no required list as no arguments', () => {
    expect(normalizeToolSurface([listed('a', { type: 'object' })])).toEqual([
      { name: 'a', args: [], hasOutputSchema: false },
    ]);
  });

  it('reads a missing required list as nothing required', () => {
    const [{ args }] = normalizeToolSurface([
      listed('a', object({ x: { type: 'string' } })),
    ]);

    expect(args).toEqual([{ name: 'x', type: 'string', required: false }]);
  });

  it('marks an argument the required list names', () => {
    const [{ args }] = normalizeToolSurface([
      listed('a', object({ x: { type: 'string' } }, ['x'])),
    ]);

    expect(args).toEqual([{ name: 'x', type: 'string', required: true }]);
  });

  it('collapses an array type to its first name', () => {
    const [{ args }] = normalizeToolSurface([
      listed('a', object({ x: { type: ['string', 'null'] } })),
    ]);

    expect(args[0].type).toBe('string');
  });

  it('collapses an array type to integer wherever it appears', () => {
    const [{ args }] = normalizeToolSurface([
      listed('a', object({ x: { type: ['number', 'integer'] } })),
    ]);

    expect(args[0].type).toBe('integer');
  });

  it('calls a type it cannot read unknown', () => {
    const surface = normalizeToolSurface([
      listed('a', object({ x: {}, y: { type: [] } })),
    ]);

    expect(surface[0].args.map(({ type }) => type)).toEqual([
      'unknown',
      'unknown',
    ]);
  });

  it('sorts enum values and keeps the type declared beside them', () => {
    const [{ args }] = normalizeToolSurface([
      listed('a', object({ x: { type: 'string', enum: ['b', 'a'] } })),
    ]);

    expect(args).toEqual([
      { name: 'x', type: 'string', required: false, enum: ['a', 'b'] },
    ]);
  });

  it('keeps only the type of an array item', () => {
    const [{ args }] = normalizeToolSurface([
      listed(
        'a',
        object({
          x: {
            type: 'array',
            items: { type: 'string', description: 'dropped' },
          },
        })
      ),
    ]);

    expect(args).toEqual([
      { name: 'x', type: 'array', required: false, items: { type: 'string' } },
    ]);
  });

  it('drops the wording and the dialect fields around an argument', () => {
    const surface = normalizeToolSurface([
      listed('a', {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { x: { type: 'string', description: 'dropped' } },
        additionalProperties: false,
        $defs: {},
      }),
    ]);

    expect(surface).toEqual([
      {
        name: 'a',
        args: [{ name: 'x', type: 'string', required: false }],
        hasOutputSchema: false,
      },
    ]);
  });

  it('reports a tool that advertises a result schema', () => {
    const surface = normalizeToolSurface([
      listed('a', object({}), { type: 'object' }),
    ]);

    expect(surface[0].hasOutputSchema).toBe(true);
  });
});

describe('expectObjectInputSchemas', () => {
  it('passes a schema that declares the object type', () => {
    expect(() =>
      expectObjectInputSchemas([listed('a', object({}))])
    ).not.toThrow();
  });

  it('fails naming the tool whose input schema is not an object', () => {
    expect(() =>
      expectObjectInputSchemas([listed('a', { type: 'string' })])
    ).toThrow(/a: string/);
  });

  it('fails on a root type that only holds object beside another name', () => {
    expect(() =>
      expectObjectInputSchemas([listed('a', { type: ['object', 'null'] })])
    ).toThrow(/a: \[object, null\]/);
  });

  it('fails on a root schema that declares no type', () => {
    expect(() => expectObjectInputSchemas([listed('a', {})])).toThrow(
      /a: undefined/
    );
  });
});
