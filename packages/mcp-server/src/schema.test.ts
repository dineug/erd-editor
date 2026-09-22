import { actionTools, type ToolArgKind } from '@dineug/erd-editor/agent.js';
import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

import { argKindSchema, argsShape } from '@/tools/schema';

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

describe('ToolArgKind to zod (axis b)', () => {
  it.each(KINDS)('%j takes %j and refuses %j', (kind, good, bad) => {
    const schema = argKindSchema(kind);
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse(bad).success).toBe(false);
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
    expect(z.toJSONSchema(schema)).toMatchObject({
      enum: ['MySQL', 'PostgreSQL'],
    });
  });

  it('throws on a kind it does not know, the never branch', () => {
    expect(() =>
      argKindSchema({ type: 'date' } as unknown as ToolArgKind)
    ).toThrow(/Unknown tool argument kind/);
  });

  it('describes every argument and makes an optional one optional', () => {
    const shape = argsShape(
      [
        {
          name: 'tableId',
          kind: { type: 'entityId', entity: 'table' },
          required: true,
        },
        { name: 'note', kind: { type: 'string' }, required: false },
      ],
      arg => `about ${arg.name}`
    );
    const object = z.object(shape);

    expect(object.safeParse({ tableId: 't' }).success).toBe(true);
    expect(object.safeParse({ note: 'n' }).success).toBe(false);
    expect(z.toJSONSchema(object)).toMatchObject({
      required: ['tableId'],
      properties: {
        tableId: { description: 'about tableId' },
        note: { description: 'about note' },
      },
    });
  });
});
