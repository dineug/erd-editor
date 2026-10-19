import { describe, expect, it } from 'vite-plus/test';

import { parser, toJson } from '@/parser';
import { toDocumentJson } from '@/storageForm';
import { createSchema, SchemaV3Constants } from '@/v3';
import { createDomain } from '@/v3/parser/domain.entity';
import { createTerm } from '@/v3/parser/term.entity';
import { createWord } from '@/v3/parser/word.entity';

import schema from '../../../json-schema/schema.json';

const { Database, OrderType, RelationshipType } = SchemaV3Constants;

type JsonSchema = {
  $ref?: string;
  type?: string;
  const?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: boolean | JsonSchema;
  prefixItems?: JsonSchema[];
  anyOf?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  $defs?: Record<string, JsonSchema>;
};

const root = schema as JsonSchema;

const typeOf = (value: unknown): string =>
  Array.isArray(value)
    ? 'array'
    : value === null
      ? 'null'
      : Number.isInteger(value)
        ? 'integer'
        : typeof value;

/**
 * The errors of a value against the keywords schema.json uses, and each
 * property it reached recorded as its schema path, so a spec can tell a
 * property no document holds from one the documents never reach.
 */
function validate(
  value: unknown,
  node: JsonSchema = root,
  at = '$',
  where = '#',
  reached = new Set<string>()
): string[] {
  if (node.$ref) {
    const name = node.$ref.replace('#/$defs/', '');
    return validate(value, root.$defs![name], at, `#/$defs/${name}`, reached);
  }

  const errors: string[] = [];
  const type = typeOf(value);
  const fits =
    node.type === undefined ||
    node.type === type ||
    (node.type === 'number' && type === 'integer');

  if (!fits) return [`${at}: ${type} is not ${node.type}`];
  if ('const' in node && JSON.stringify(node.const) !== JSON.stringify(value)) {
    errors.push(`${at}: not ${JSON.stringify(node.const)}`);
  }
  if (
    node.anyOf &&
    !node.anyOf.some(branch => validate(value, branch, at, where).length === 0)
  ) {
    errors.push(`${at}: fits none of anyOf`);
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is outside the enum`);
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) {
      errors.push(`${at}: below ${node.minimum}`);
    }
    if (node.maximum !== undefined && value > node.maximum) {
      errors.push(`${at}: above ${node.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) {
      errors.push(`${at}: fewer than ${node.minItems} items`);
    }
    if (node.maxItems !== undefined && value.length > node.maxItems) {
      errors.push(`${at}: more than ${node.maxItems} items`);
    }
    value.forEach((item, index) => {
      const itemNode = node.prefixItems?.[index] ?? node.items;
      if (itemNode === false) {
        errors.push(`${at}[${index}]: is not allowed`);
      } else if (typeof itemNode === 'object') {
        errors.push(
          ...validate(item, itemNode, `${at}[${index}]`, where, reached)
        );
      }
    });
  }

  if (type === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of node.required ?? []) {
      if (!(key in object)) errors.push(`${at}: missing ${key}`);
    }
    for (const [key, child] of Object.entries(object)) {
      const property = node.properties?.[key];
      if (property) {
        reached.add(`${where}/${key}`);
        errors.push(
          ...validate(
            child,
            property,
            `${at}.${key}`,
            `${where}/${key}`,
            reached
          )
        );
      } else if (node.additionalProperties === false) {
        errors.push(`${at}: ${key} is not allowed`);
      } else if (typeof node.additionalProperties === 'object') {
        errors.push(
          ...validate(
            child,
            node.additionalProperties,
            `${at}.${key}`,
            `${where}/*`,
            reached
          )
        );
      }
    }
  }

  return errors;
}

/** Every property schema.json names, as the schema path validate records. */
function namedProperties(
  node: JsonSchema = root,
  where = '#',
  seen = new Set<string>()
): string[] {
  if (node.$ref) {
    const name = node.$ref.replace('#/$defs/', '');
    if (seen.has(name)) return [];
    seen.add(name);
    return namedProperties(root.$defs![name], `#/$defs/${name}`, seen);
  }

  return [
    ...Object.entries(node.properties ?? {}).flatMap(([key, child]) => [
      `${where}/${key}`,
      ...namedProperties(child, `${where}/${key}`, seen),
    ]),
    ...(typeof node.additionalProperties === 'object'
      ? namedProperties(node.additionalProperties, `${where}/*`, seen)
      : []),
    ...(typeof node.items === 'object'
      ? namedProperties(node.items, where, seen)
      : []),
  ];
}

/**
 * A document that reaches every saved field: groups, scripts, logical names,
 * domain links, a full row in each dictionary and every other entity.
 */
const FULL = toDocumentJson(
  parser(
    JSON.stringify({
      version: '3.0.0',
      settings: {
        database: Database.PostgreSQL,
        databaseName: 'shop',
        ddlScripts: { before: 'SET search_path = shop;', after: '' },
      },
      doc: {
        tableIds: ['t1', 't2'],
        relationshipIds: ['r1'],
        indexIds: ['i1'],
        memoIds: ['m1'],
        tableGroupIds: ['g1'],
      },
      collections: {
        tableEntities: {
          t1: {
            id: 't1',
            name: 'users',
            logicalName: 'User',
            columnIds: ['c1'],
            groupId: 'g1',
            nameDerived: true,
          },
          t2: { id: 't2', name: 'orders', columnIds: ['c2'] },
        },
        tableColumnEntities: {
          c1: {
            id: 'c1',
            tableId: 't1',
            name: 'USER_NO',
            options: 2 | 16,
            logicalName: 'User Number',
            domainId: 'd1',
          },
          c2: { id: 'c2', tableId: 't2', name: 'user_id' },
        },
        relationshipEntities: {
          r1: {
            id: 'r1',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c2'] },
          },
        },
        indexEntities: {
          i1: { id: 'i1', name: 'ix', tableId: 't2', indexColumnIds: ['ic1'] },
        },
        indexColumnEntities: {
          ic1: {
            id: 'ic1',
            indexId: 'i1',
            columnId: 'c2',
            orderType: OrderType.DESC,
          },
        },
        memoEntities: { m1: { id: 'm1', value: 'note' } },
        tableGroupEntities: { g1: { id: 'g1', name: 'billing' } },
        wordEntities: {
          fields: Object.keys(createWord()),
          rows: [['w1', 'user', 'USER', 'user', 'one', 'member', 'client']],
        },
        termEntities: {
          fields: Object.keys(createTerm()),
          rows: [['tm1', 'User Number', 'USER_NO', 'd1', 'one', 'user id']],
        },
        domainEntities: {
          fields: Object.keys(createDomain()),
          rows: [['d1', 'NumberN10', 'number', 'NUMERIC(10)', 'a count']],
        },
      },
    })
  )
);

const full = () => JSON.parse(FULL);

describe('json-schema/schema.json', () => {
  it('accepts the storage form of a document that holds every kind of entity', () => {
    expect(validate(full())).toEqual([]);
  });

  it('accepts the storage form of a new document, which holds no group', () => {
    expect(validate(JSON.parse(toDocumentJson(createSchema())))).toEqual([]);
  });

  it('names no property the storage form never writes', () => {
    const reached = new Set<string>();
    validate(full(), root, '$', '#', reached);

    expect(namedProperties().filter(path => !reached.has(path))).toEqual([]);
  });

  it('refuses the runtime value, whose fields a file does not hold', () => {
    const errors = validate(JSON.parse(toJson(parser(FULL))));

    expect(errors).toContain(
      '$.collections.tableEntities.t1: seqColumnIds is not allowed'
    );
    expect(errors).toContain(
      '$.collections.tableEntities.t1.ui: zIndex is not allowed'
    );
    expect(errors).toContain(
      '$.collections.tableColumnEntities.c1: ui is not allowed'
    );
  });

  it.each([
    ['settings', 'width', 4000],
    ['settings', 'scrollTop', -120],
    ['settings', 'relationshipOptimization', false],
    ['settings', 'ignoreSaveSettings', 3],
    ['settings', 'lockedValues', {}],
    ['collections.tableEntities.t1', 'meta', { updateAt: 1, createAt: 1 }],
    ['collections.tableEntities.t1.ui', 'widthName', 60],
    ['collections.tableEntities.t1.ui', 'widthLogicalName', 60],
    ['collections.tableColumnEntities.c1', 'ui', { widthDomain: 60 }],
    ['doc', 'wordIds', ['w1']],
    ['collections.relationshipEntities.r1', 'identification', false],
    ['collections.relationshipEntities.r1', 'startRelationshipType', 2],
    ['collections.relationshipEntities.r1.start', 'direction', 2],
    ['collections.indexEntities.i1', 'seqIndexColumnIds', ['ic1']],
    ['collections.memoEntities.m1.ui', 'zIndex', 2],
    ['collections.tableGroupEntities.g1.ui', 'zIndex', 1],
  ])('refuses %s.%s, which the storage form leaves out', (path, key, value) => {
    const document = full();
    const target = path
      .split('.')
      .reduce((object, part) => object[part], document);
    target[key] = value;

    expect(validate(document)).toEqual([`$.${path}: ${key} is not allowed`]);
  });

  it('accepts a column order of nine with the new column types moved', () => {
    const document = full();
    document.settings.columnOrder = [1, 128, 2, 4, 8, 16, 32, 64, 256];

    expect(validate(document)).toEqual([]);
  });

  it.each([
    ['eight', [1, 2, 4, 8, 16, 32, 64, 128]],
    ['six', [1, 2, 4, 8, 16, 32]],
  ])('refuses a column order of %s entries', (_, columnOrder) => {
    const document = full();
    document.settings.columnOrder = columnOrder;

    expect(validate(document)).toEqual([
      '$.settings.columnOrder: fits none of anyOf',
    ]);
  });

  it('refuses a dictionary row past its fields, short of a name, or a header of its own', () => {
    const document = full();
    document.collections.wordEntities.rows.push(['w2']);
    document.collections.domainEntities.rows[0].push('extra');
    document.collections.termEntities.fields = ['id', 'name'];

    expect(validate(document)).toEqual([
      '$.collections.wordEntities.rows[1]: fewer than 2 items',
      `$.collections.termEntities.fields: not ${JSON.stringify(
        Object.keys(createTerm())
      )}`,
      '$.collections.domainEntities.rows[0][5]: is not allowed',
    ]);
  });

  it('refuses a derived flag that is not true, which the storage form leaves out', () => {
    const document = full();
    document.collections.tableEntities.t1.nameDerived = false;

    expect(validate(document)).toEqual([
      '$.collections.tableEntities.t1.nameDerived: not true',
    ]);
  });

  it('refuses a document without a field the storage form always writes', () => {
    const document = full();
    delete document.settings.lockSettings;
    delete document.collections.tableEntities.t2.ui.color;

    expect(validate(document)).toEqual([
      '$.settings: missing lockSettings',
      '$.collections.tableEntities.t2.ui: missing color',
    ]);
  });
});
