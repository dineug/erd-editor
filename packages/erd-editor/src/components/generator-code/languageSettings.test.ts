import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import {
  codeFileExtension,
  LanguageToExtensionMap,
  readsBracket,
  readsDatabase,
  readsNameCases,
} from '@/components/generator-code/languageSettings';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import {
  ColumnOption,
  Language,
  LanguageList,
  NameCase,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createGeneratorCode } from '@/utils/generator-code';

/**
 * Types whose mapping differs between vendors, under names each case turns
 * another way, with a reserved word and a schema the bracket decides on.
 */
const COLUMNS: Array<[string, string]> = [
  ['user_id', 'uuid'],
  ['order', 'int'],
  ['profile_json', 'json'],
  ['tag_list', 'text[]'],
  ['amount', 'money'],
  ['flag', 'tinyint'],
  ['created_at', 'timestamp with time zone'],
  ['payload', 'variant'],
  ['big_count', 'bigint unsigned'],
  ['code', 'NUMBER(10,2)'],
];

/**
 * One table of those columns and a table named with a reserved word, which JPA
 * quotes under a bracket type, in the language given and nothing else changed.
 */
function createState(language: number): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;
  const columns = COLUMNS.map(([name, dataType], index) =>
    createColumn({
      id: `c${index}`,
      tableId: 't',
      name,
      dataType,
      options: index === 0 ? ColumnOption.primaryKey : 0,
    })
  );
  const table = createTable({
    id: 't',
    name: 'shop.user_account',
    columnIds: columns.map(column => column.id),
  });

  const reservedColumn = createColumn({
    id: 'r0',
    tableId: 'r',
    name: 'id',
    dataType: 'int',
    options: ColumnOption.primaryKey,
  });
  const reserved = createTable({
    id: 'r',
    name: 'order',
    columnIds: [reservedColumn.id],
  });

  state.settings.language = language;
  [table, reserved].forEach(entity => {
    state.collections.tableEntities[entity.id] = entity;
    state.doc.tableIds.push(entity.id);
  });
  [...columns, reservedColumn].forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  return state;
}

/** Whether the language writes another text for any of the values given. */
function follows(
  language: number,
  values: ReadonlyArray<number>,
  set: (settings: RootState['settings'], value: number) => void
): boolean {
  const texts = values.map(value => {
    const state = createState(language);
    set(state.settings, value);
    return createGeneratorCode(state);
  });
  return new Set(texts).size > 1;
}

const CASES = [NameCase.pascalCase, NameCase.snakeCase, NameCase.none];

describe('the settings each language follows', () => {
  it.each(languageMenus)('$name follows what the panel says it does', menu => {
    const language = menu.value;

    expect(createGeneratorCode(createState(language))).not.toBe('');
    expect({
      database: follows(
        language,
        databaseMenus.map(database => database.value),
        (settings, value) => {
          settings.database = value;
        }
      ),
      tableNameCase: follows(language, CASES, (settings, value) => {
        settings.tableNameCase = value;
      }),
      columnNameCase: follows(language, CASES, (settings, value) => {
        settings.columnNameCase = value;
      }),
      bracketType: follows(
        language,
        bracketMenus.map(bracket => bracket.value),
        (settings, value) => {
          settings.bracketType = value;
        }
      ),
    }).toEqual({
      database: readsDatabase(language),
      tableNameCase: readsNameCases(language),
      columnNameCase: readsNameCases(language),
      bracketType: readsBracket(language),
    });
  });
});

describe('codeFileExtension', () => {
  it('names an extension for every language there is', () => {
    expect(
      LanguageList.filter(language => !LanguageToExtensionMap[language])
    ).toEqual([]);
  });

  it.each([
    [Language.TypeScript, '.ts'],
    [Language.TypeORM, '.ts'],
    [Language.Sequelize, '.ts'],
    [Language.Drizzle, '.ts'],
    [Language.Zod, '.ts'],
    [Language.GraphQL, '.graphql'],
    [Language.csharp, '.cs'],
    [Language.Java, '.java'],
    [Language.JPA, '.java'],
    [Language.Kotlin, '.kt'],
    [Language.Scala, '.scala'],
    [Language.Go, '.go'],
    [Language.SQLAlchemy, '.py'],
    [Language.DBML, '.dbml'],
    [Language.AML, '.aml'],
    [Language.Mermaid, '.mmd'],
    [Language.PHP, '.php'],
    [Language.Doctrine, '.php'],
    [Language.Rust, '.rs'],
    [Language.SeaORM, '.rs'],
    [Language.Swift, '.swift'],
    [Language.JSONSchema, '.json'],
  ])('saves language %i as %s', (language, extension) => {
    expect(codeFileExtension(language)).toBe(extension);
  });

  it('saves a language this editor does not know as plain text', () => {
    expect(codeFileExtension(0)).toBe('.txt');
  });
});
