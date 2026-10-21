import { describe, expect, it } from 'vite-plus/test';

import {
  DictionaryFields,
  DictionaryKeyList,
  fromDictionaryRows,
  RuntimeDictionaryFields,
  stringifyDocument,
  toDictionaryRows,
} from '@/dictionaryRows';
import { createDomain } from '@/v3/parser/domain.entity';
import { createTerm } from '@/v3/parser/term.entity';
import { createWord } from '@/v3/parser/word.entity';

describe('DictionaryFields', () => {
  it('names every field of each entity, id first, in the order it declares them, a file all but the order key', () => {
    const fieldsOf = (entity: object) => Object.keys(entity);
    const fileFieldsOf = (entity: object) =>
      fieldsOf(entity).filter(field => field !== 'order');

    expect(DictionaryFields).toEqual({
      wordEntities: fileFieldsOf(createWord()),
      termEntities: fileFieldsOf(createTerm()),
      domainEntities: fileFieldsOf(createDomain()),
    });
    const withOrderKey = (fields: ReadonlyArray<string>) => [
      ...fields.slice(0, 2),
      'order',
      ...fields.slice(2),
    ];
    expect(RuntimeDictionaryFields).toEqual({
      wordEntities: withOrderKey(DictionaryFields.wordEntities),
      termEntities: withOrderKey(DictionaryFields.termEntities),
      domainEntities: withOrderKey(DictionaryFields.domainEntities),
    });
    expect([...RuntimeDictionaryFields.wordEntities].sort()).toEqual(
      fieldsOf(createWord()).sort()
    );
    expect(DictionaryKeyList).toEqual([
      'wordEntities',
      'termEntities',
      'domainEntities',
    ]);
  });
});

describe('toDictionaryRows', () => {
  it('writes the header once and each entity as its values in header order', () => {
    const word = {
      ...createWord(),
      id: 'w1',
      name: 'member',
      abbreviation: 'MBR',
      englishName: 'member',
      description: 'one who joined',
      synonyms: 'user',
      forbiddenWords: 'client',
    };

    expect(toDictionaryRows('wordEntities', [word])).toEqual({
      fields: [
        'id',
        'name',
        'abbreviation',
        'englishName',
        'description',
        'synonyms',
        'forbiddenWords',
      ],
      rows: [
        ['w1', 'member', 'MBR', 'member', 'one who joined', 'user', 'client'],
      ],
    });
  });

  it('leaves the trailing empty values out and keeps the ones in the middle', () => {
    const terms = [
      { ...createTerm(), id: 'tm1', name: 'member no', description: 'kept' },
      {
        ...createTerm(),
        id: 'tm2',
        name: 'joined at',
        physicalName: 'JOIN_AT',
      },
    ];

    expect(toDictionaryRows('termEntities', terms).rows).toEqual([
      ['tm1', 'member no', '', '', 'kept'],
      ['tm2', 'joined at', 'JOIN_AT'],
    ]);
  });

  it('keeps the id and the name of a row, empty or not', () => {
    const domain = { ...createDomain(), id: 'd1' };

    expect(toDictionaryRows('domainEntities', [domain]).rows).toEqual([
      ['d1', ''],
    ]);
  });

  it('counts an empty array as an empty value', () => {
    const word = { ...createWord(), id: 'w1', name: 'x', synonyms: [] };

    expect(toDictionaryRows('wordEntities', [word]).rows).toEqual([
      ['w1', 'x'],
    ]);
  });

  it('writes the rows in the order given', () => {
    const domains = ['d3', 'd1', 'd2'].map(id => ({ ...createDomain(), id }));

    expect(
      toDictionaryRows('domainEntities', domains).rows.map(([id]) => id)
    ).toEqual(['d3', 'd1', 'd2']);
  });
});

describe('fromDictionaryRows', () => {
  it('reads each row by the field names of the header', () => {
    expect(
      fromDictionaryRows({
        fields: ['id', 'name', 'dataType'],
        rows: [
          ['d1', 'amount', 'NUMERIC(15)'],
          ['d2', 'code'],
        ],
      })
    ).toEqual([
      { id: 'd1', name: 'amount', dataType: 'NUMERIC(15)' },
      { id: 'd2', name: 'code' },
    ]);
  });

  it('reads a header in any order, its unknown names as given', () => {
    expect(
      fromDictionaryRows({
        fields: ['name', 'unit', 'id'],
        rows: [['amount', 'won', 'd1']],
      })
    ).toEqual([{ name: 'amount', unit: 'won', id: 'd1' }]);
  });

  it('skips a row that is not an array and values past the header', () => {
    expect(
      fromDictionaryRows({
        fields: ['id'],
        rows: [{ id: 'x' }, 'd0', ['d1', 'extra']],
      })
    ).toEqual([{ id: 'd1' }]);
  });

  it('keeps a header name like __proto__ a field of its own', () => {
    const [value] = fromDictionaryRows({
      fields: ['__proto__', 'id'],
      rows: [[{ name: 'injected' }, 'd1']],
    });

    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(value.name).toBeUndefined();
    expect(value.id).toBe('d1');
  });

  it('reads the values of an id map, as an editor holds the collection', () => {
    expect(
      fromDictionaryRows({ d1: { id: 'd1' }, d2: { id: 'd2' }, bad: 'x' })
    ).toEqual([{ id: 'd1' }, { id: 'd2' }]);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', [['d1']]],
    ['a string', 'd1'],
  ])('reads nothing from %s', (_, json) => {
    expect(fromDictionaryRows(json)).toEqual([]);
  });
});

describe('stringifyDocument', () => {
  const document = (collections: Record<string, unknown>) => ({
    version: '3.0.0',
    collections: { tableEntities: {}, ...collections },
  });

  it('writes each dictionary row on a line of its own, the rest as JSON.stringify does', () => {
    const text = stringifyDocument(
      document({
        wordEntities: {
          fields: ['id', 'name'],
          rows: [
            ['w1', 'member'],
            ['w2', 'order'],
          ],
        },
        domainEntities: { fields: ['id', 'name'], rows: [['d1', 'amount']] },
      })
    );

    expect(text).toBe(
      [
        '{',
        '  "version": "3.0.0",',
        '  "collections": {',
        '    "tableEntities": {},',
        '    "wordEntities": {',
        '      "fields": [',
        '        "id",',
        '        "name"',
        '      ],',
        '      "rows": [',
        '        ["w1","member"],',
        '        ["w2","order"]',
        '      ]',
        '    },',
        '    "domainEntities": {',
        '      "fields": [',
        '        "id",',
        '        "name"',
        '      ],',
        '      "rows": [',
        '        ["d1","amount"]',
        '      ]',
        '    }',
        '  }',
        '}',
      ].join('\n')
    );
  });

  it('fills the placeholders in the order the collections are written', () => {
    const text = stringifyDocument(
      document({
        domainEntities: { fields: ['id'], rows: [['d1']] },
        termEntities: { fields: ['id'], rows: [['tm1']] },
      })
    );

    expect(text.indexOf('["d1"]')).toBeLessThan(text.indexOf('["tm1"]'));
    expect(JSON.parse(text).collections).toEqual({
      tableEntities: {},
      domainEntities: { fields: ['id'], rows: [['d1']] },
      termEntities: { fields: ['id'], rows: [['tm1']] },
    });
  });

  it('leaves a dictionary without rows as an empty array', () => {
    const text = stringifyDocument(
      document({ termEntities: { fields: ['id'], rows: [] } })
    );

    expect(text).toContain('\n      "rows": []\n');
    expect(JSON.parse(text).collections.termEntities.rows).toEqual([]);
  });

  it('writes a value holding the placeholder text as any other string', () => {
    const tricky = '"rows": []';
    const source = document({
      tableEntities: { t1: { id: 't1', name: tricky } },
      wordEntities: {
        fields: ['id', 'name'],
        rows: [['w1', `\n      ${tricky}`]],
      },
    });

    expect(JSON.parse(stringifyDocument(source))).toEqual(source);
  });

  it('writes a collection outside the dictionaries as it stands', () => {
    const source = document({
      memoEntities: { fields: ['id'], rows: [['m1']] },
    });

    expect(stringifyDocument(source)).toBe(JSON.stringify(source, null, 2));
  });

  it('never changes the document it is handed', () => {
    const source = document({
      wordEntities: { fields: ['id'], rows: [['w1']] },
    });
    const before = structuredClone(source);

    stringifyDocument(source);

    expect(source).toEqual(before);
  });
});
