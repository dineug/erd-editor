/// <reference types="vite/client" />
import { isPlainObject } from 'es-toolkit';
import { describe, expect, it } from 'vite-plus/test';

import { parser, toJson } from '@/parser';
import { toDocumentJson } from '@/storageForm';
import { createSchema } from '@/v3';

// Each file is the storage form an earlier release wrote of a document that
// holds no logical name, domain or dictionary, read here as the bytes it holds.
const files = import.meta.glob<string>('./__fixtures__/storage-form/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const names = Object.keys(files).map(path => path.split('/').pop()!);

const dropEmptyText = (object: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(object)) {
    if (value === '') delete object[key];
  }
};

const dropEmpty = (object: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(object)) {
    const empty = Array.isArray(value)
      ? value.length === 0
      : isPlainObject(value) && Object.keys(value).length === 0;
    if (empty) delete object[key];
  }
};

/**
 * A file an earlier release wrote, as a save today writes it again: each text
 * an entity or its ui holds as '' left out, then each list or collection that
 * holds nothing and the collections once empty, every other byte as it was.
 */
function withoutEmpty(file: string): string {
  const document = JSON.parse(file);

  for (const entities of Object.values<Record<string, any>>(
    document.collections
  )) {
    for (const entity of Object.values<Record<string, any>>(entities)) {
      dropEmptyText(entity);
      if (entity.ui) dropEmptyText(entity.ui);
    }
  }
  dropEmpty(document.collections);
  dropEmpty(document.doc);
  if (Object.keys(document.collections).length === 0) {
    delete document.collections;
  }

  return `${JSON.stringify(document, null, 2)}\n`;
}

describe('the storage form an earlier release wrote', () => {
  it('reads every saved fixture', () => {
    expect(names.sort()).toEqual([
      'custom-column-order.json',
      'data-test-v2.json',
      'json-schema-full.json',
      'legacy-tombstones.json',
      'new-document.json',
      'obsidian-legacy-v2.json',
      'unlocked-settings.json',
      'vscode-sample.json',
    ]);
  });

  it.each(Object.entries(files))(
    'writes %s back without what it holds empty alone',
    (_, file) => {
      expect(toDocumentJson(parser(file))).toBe(withoutEmpty(file));
    }
  );

  it.each(Object.entries(files))(
    'reads %s saved again as it read before, and saves that byte for byte',
    (_, file) => {
      const saved = toDocumentJson(parser(file));

      expect(toJson(parser(saved))).toBe(toJson(parser(file)));
      expect(toDocumentJson(parser(saved))).toBe(saved);
    }
  );
});

const TEXTS = ['', '', '', ' ', '\t', 'id', '회원', "''", 'NUMERIC(10)'];

/** A generator seeded by a number, so a failing seed builds its document again. */
function seeded(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number) => Math.floor(next() * count);
  const pick = <T>(list: ReadonlyArray<T>) => list[int(list.length)];

  return { int, pick, text: () => pick(TEXTS) };
}

const range = (count: number, id: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => id(index));

/**
 * A random document as an earlier release saved it, every text field written
 * whether empty or not: tables, columns, relationships, indexes, index columns,
 * memos and groups, its ids in the order the storage form sorts them.
 */
function earlierFile(seed: number): string {
  const { int, pick, text } = seeded(seed);
  const position = () => ({ x: int(5) * 50 - 100, y: int(5) * 25 });

  const tableGroupIds = range(int(3), index => `g${index}`);
  const tableIds = range(1 + int(4), index => `t${index}`);
  const columnIdsOf = new Map(
    tableIds.map(id => [id, range(int(4), index => `${id}c${index}`)])
  );
  const relationshipIds = range(int(3), index => `r${index}`);
  const indexIds = range(int(3), index => `i${index}`);
  const memoIds = range(int(3), index => `m${index}`);

  const point = () => {
    const tableId = pick(tableIds);
    const columnIds = columnIdsOf.get(tableId)!;
    return {
      tableId,
      columnIds: columnIds.slice(0, int(columnIds.length + 1)),
    };
  };

  const indexes = indexIds.map(id => {
    const tableId = pick(tableIds);
    const columnIds = columnIdsOf.get(tableId)!;
    const indexColumns = columnIds
      .slice(0, int(columnIds.length + 1))
      .map((columnId, index) => ({
        id: `${id}x${index}`,
        indexId: id,
        columnId,
        orderType: pick([1, 2]),
      }));
    const index = {
      id,
      name: text(),
      tableId,
      indexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
      unique: int(2) === 1,
    };

    return { index, indexColumns };
  });

  const byId = <T extends { id: string }>(entities: T[]) =>
    Object.fromEntries(entities.map(entity => [entity.id, entity]));

  const document = {
    $schema: JSON.parse(toDocumentJson(createSchema())).$schema,
    version: '3.0.0',
    settings: JSON.parse(toDocumentJson(createSchema())).settings,
    doc: {
      tableIds,
      relationshipIds,
      indexIds,
      memoIds,
      ...(tableGroupIds.length ? { tableGroupIds } : {}),
    },
    collections: {
      tableEntities: byId(
        tableIds.map(id => ({
          id,
          name: text(),
          ...(int(3) === 0 ? { logicalName: pick(['회원', ' 번호 ']) } : {}),
          comment: text(),
          columnIds: columnIdsOf.get(id)!,
          ...(tableGroupIds.length && int(2)
            ? { groupId: pick(tableGroupIds) }
            : {}),
          ...(int(2) ? { nameDerived: true } : {}),
          ui: { ...position(), color: text() },
        }))
      ),
      tableColumnEntities: byId(
        tableIds.flatMap(tableId =>
          columnIdsOf.get(tableId)!.map(id => ({
            id,
            tableId,
            name: text(),
            comment: text(),
            dataType: text(),
            default: text(),
            options: int(32),
          }))
        )
      ),
      relationshipEntities: byId(
        relationshipIds.map(id => ({
          id,
          relationshipType: pick([2, 4, 8, 16]),
          onDelete: pick([1, 2, 4, 8, 16, 32]),
          onUpdate: pick([1, 2, 4, 8, 16, 32]),
          start: point(),
          end: point(),
        }))
      ),
      indexEntities: byId(indexes.map(({ index }) => index)),
      indexColumnEntities: byId(
        indexes.flatMap(({ indexColumns }) => indexColumns)
      ),
      memoEntities: byId(
        memoIds.map(id => ({
          id,
          value: text(),
          ui: { ...position(), width: 116, height: 100, color: text() },
        }))
      ),
      ...(tableGroupIds.length
        ? {
            tableGroupEntities: byId(
              tableGroupIds.map(id => ({
                id,
                name: text(),
                color: text(),
                ui: { ...position(), width: 400, height: 300 },
              }))
            ),
          }
        : {}),
    },
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}

describe('a random document an earlier release saved', () => {
  const seeds = Array.from({ length: 300 }, (_, index) => index + 1);

  it('is saved again without what it holds empty alone, the value a parse reads kept', () => {
    for (const seed of seeds) {
      const file = earlierFile(seed);
      const saved = toDocumentJson(parser(file));

      expect(saved, `seed ${seed}`).toBe(withoutEmpty(file));
      expect(toJson(parser(saved)), `seed ${seed}`).toBe(toJson(parser(file)));
      expect(toDocumentJson(parser(saved)), `seed ${seed}`).toBe(saved);
    }
  });

  it('draws empty text and blank text, which is a value a save keeps', () => {
    const texts = seeds.map(earlierFile).join('');

    expect(texts).toContain('"comment": ""');
    expect(texts).toContain('"dataType": " "');
    expect(texts).toContain('"default": "\\t"');
  });
});
