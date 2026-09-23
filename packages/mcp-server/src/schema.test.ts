import { Schema } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { actionTools, type ToolArgKind } from '@/tools/registry';
import { argKindSchema, argsFields, toolInputSchema } from '@/tools/schema';

/** One kind of each type, with a value it takes and one it refuses. */
const KINDS: Array<[ToolArgKind, unknown, unknown]> = [
  [{ type: 'string' }, 'users', 1],
  [{ type: 'number' }, 1.5, '1.5'],
  [{ type: 'integer' }, 3, 3.5],
  [{ type: 'boolean' }, false, 'false'],
  [{ type: 'enum', values: { ZeroN: 1, OneN: 2 } }, 'OneN', 2],
  [{ type: 'entityId', entity: 'table' }, 'abc', null],
  [
    { type: 'entityIdList', entity: 'column', parentArg: 'tableId' },
    ['a', 'b'],
    'a',
  ],
];

const takes = (schema: Schema.Top, value: unknown) => Schema.is(schema)(value);

const jsonSchema = (schema: Schema.Top) =>
  Schema.toJsonSchemaDocument(schema).schema;

describe('ToolArgKind to effect Schema', () => {
  it.each(KINDS)('%j takes %j and refuses %j', (kind, good, bad) => {
    const schema = argKindSchema(kind);
    expect(takes(schema, good)).toBe(true);
    expect(takes(schema, bad)).toBe(false);
  });

  it('covers every kind type the registry uses', () => {
    const used = new Set(
      actionTools.flatMap(({ args }) => args.map(({ kind }) => kind.type))
    );
    const covered = new Set(KINDS.map(([kind]) => kind.type));
    for (const type of used) expect(covered).toContain(type);
  });

  it('turns enum names, not their values, into the choices', () => {
    const schema = argKindSchema({
      type: 'enum',
      values: { MySQL: 8, PostgreSQL: 16 },
    });
    expect(jsonSchema(schema)).toMatchObject({
      type: 'string',
      enum: ['MySQL', 'PostgreSQL'],
    });
  });

  it('advertises numbers as one plain JSON type, and refuses what JSON cannot carry', () => {
    expect(jsonSchema(argKindSchema({ type: 'number' }))).toEqual({
      type: 'number',
    });
    expect(jsonSchema(argKindSchema({ type: 'integer' }))).toEqual({
      type: 'integer',
    });
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(takes(argKindSchema({ type: 'number' }), value)).toBe(false);
    }
  });

  it('throws on a kind it does not know, the never branch', () => {
    expect(() =>
      argKindSchema({ type: 'date' } as unknown as ToolArgKind)
    ).toThrow(/Unknown tool argument kind/);
  });

  it('describes every argument and makes an optional one optional', () => {
    const object = Schema.Struct(
      argsFields(
        [
          {
            name: 'tableId',
            kind: { type: 'entityId', entity: 'table' },
            required: true,
          },
          { name: 'note', kind: { type: 'string' }, required: false },
        ],
        arg => `about ${arg.name}`
      )
    );

    expect(takes(object, { tableId: 't' })).toBe(true);
    expect(takes(object, { note: 'n' })).toBe(false);
    expect(jsonSchema(object)).toMatchObject({
      required: ['tableId'],
      properties: {
        tableId: { type: 'string', description: 'about tableId' },
        note: { type: 'string', description: 'about note' },
      },
    });
  });
});

describe('the input schema a tool lists from its own struct', () => {
  const Params = Schema.Struct({
    path: Schema.String,
    create: Schema.optionalKey(Schema.Boolean),
  });

  it('closes the object when strict and opens it otherwise, as the toolkit lists either', () => {
    const shape = {
      type: 'object',
      properties: { path: { type: 'string' }, create: { type: 'boolean' } },
      required: ['path'],
    };

    expect(toolInputSchema('erd_strict', Params, true)).toEqual({
      ...shape,
      additionalProperties: false,
    });
    expect(toolInputSchema('erd_open', Params, false)).toEqual({
      ...shape,
      additionalProperties: true,
    });
  });

  it('refuses a root that is not an object, naming the tool', () => {
    expect(() => toolInputSchema('erd_text', Schema.String, true)).toThrow(
      /erd_text must take one inline object of arguments/
    );
  });

  it('refuses an object that needs $defs, which the older protocols drop', () => {
    const Referenced = Schema.Struct({
      id: Schema.String.annotate({ identifier: 'Id' }),
    });

    expect(() => toolInputSchema('erd_ref', Referenced, false)).toThrow(
      /erd_ref must take one inline object of arguments/
    );
  });
});
