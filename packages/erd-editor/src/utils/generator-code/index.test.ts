import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, Language } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/utils/generator-code';

function createFixture(): { state: RootState; table: Table } {
  const state = schemaV3Parser({}) as unknown as RootState;
  const table = createTable({
    id: 't1',
    name: 'user',
    columnIds: ['c1'],
  });
  const column = createColumn({
    id: 'c1',
    tableId: 't1',
    name: 'created_at',
    dataType: 'INT',
    options: ColumnOption.notNull,
  });

  state.doc.tableIds = [table.id];
  state.collections.tableEntities[table.id] = table;
  state.collections.tableColumnEntities[column.id] = column;
  state.settings.database = Database.MySQL;

  return { state, table };
}

const expectedByLanguage: Array<[string, number, string[]]> = [
  [
    'GraphQL',
    Language.GraphQL,
    ['', 'type User {', '  createdAt: Int!', '}', ''],
  ],
  [
    'JPA',
    Language.JPA,
    [
      '',
      '@Data',
      '@Entity',
      'public class User {',
      '  @Column(nullable = false)',
      '  private Integer createdAt;',
      '}',
      '',
    ],
  ],
  [
    'TypeScript',
    Language.TypeScript,
    ['', 'export interface User {', '  createdAt: number;', '}', ''],
  ],
  [
    'csharp',
    Language.csharp,
    [
      '',
      'public class User {',
      '  public int CreatedAt { get; set; }',
      '}',
      '',
    ],
  ],
  [
    'Java',
    Language.Java,
    [
      '',
      '@Data',
      'public class User {',
      '  private Integer createdAt;',
      '}',
      '',
    ],
  ],
  [
    'Kotlin',
    Language.Kotlin,
    ['', 'class User {', '  var createdAt: Int = 0', '}', ''],
  ],
  [
    'Scala',
    Language.Scala,
    ['', '@Data', 'case class User(', ' createdAt: Int', ')', ''],
  ],
  [
    'Go',
    Language.Go,
    [
      '',
      'type User struct {',
      '\tCreatedAt int32 `json:"created_at"`',
      '}',
      '',
    ],
  ],
  [
    'SQLAlchemy',
    Language.SQLAlchemy,
    [
      '',
      'from sqlalchemy import Integer',
      'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
      '',
      '',
      'class Base(DeclarativeBase):',
      '    pass',
      '',
      '',
      'class User(Base):',
      '    __tablename__ = "user"',
      '',
      '    createdAt: Mapped[int] = mapped_column("created_at", Integer, nullable=False)',
      '',
    ],
  ],
  [
    'TypeORM',
    Language.TypeORM,
    [
      '',
      '@Entity("user")',
      'export class User {',
      '  @Column("int", { name: "created_at" })',
      '  createdAt: number;',
      '}',
      '',
    ],
  ],
];

describe('generator-code/index', () => {
  describe('createGeneratorCode', () => {
    it.each(expectedByLanguage)(
      'generates %s for the whole document',
      (_name, language, expected) => {
        const { state } = createFixture();
        state.settings.language = language;

        expect(createGeneratorCode(state).split('\n')).toEqual(expected);
      }
    );

    it('returns an empty string for an unsupported language', () => {
      const { state } = createFixture();
      state.settings.language = 0;

      expect(createGeneratorCode(state)).toBe('');
    });
  });

  describe('createGeneratorCodeTable', () => {
    it.each(expectedByLanguage)(
      'generates %s for a single table',
      (_name, language, expected) => {
        const { state, table } = createFixture();
        state.settings.language = language;

        expect(createGeneratorCodeTable(state, table).split('\n')).toEqual(
          expected
        );
      }
    );

    it('returns an empty string for an unsupported language', () => {
      const { state, table } = createFixture();
      state.settings.language = 0;

      expect(createGeneratorCodeTable(state, table)).toBe('');
    });

    it('renders the given table even when it is not part of doc.tableIds', () => {
      const { state, table } = createFixture();
      state.settings.language = Language.Java;
      state.doc.tableIds = [];

      expect(createGeneratorCode(state)).toBe('');
      expect(createGeneratorCodeTable(state, table).split('\n')).toEqual([
        '',
        '@Data',
        'public class User {',
        '  private Integer createdAt;',
        '}',
        '',
      ]);
    });
  });
});
