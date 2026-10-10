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
      '@Table(name = "user")',
      'public class User {',
      '  @Column(name = "created_at", nullable = false)',
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
    ['', 'data class User(', '    val createdAt: Int,', ')', ''],
  ],
  [
    'Scala',
    Language.Scala,
    ['', 'case class User(', '  createdAt: Int', ')', ''],
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
  [
    'Sequelize',
    Language.Sequelize,
    [
      '',
      'export class User extends Model<',
      '  InferAttributes<User>,',
      '  InferCreationAttributes<User>',
      '> {',
      '  declare createdAt: number;',
      '}',
      '',
      'User.init(',
      '  {',
      '    createdAt: {',
      '      type: DataTypes.INTEGER,',
      '      field: "created_at",',
      '      allowNull: false,',
      '    },',
      '  },',
      '  { sequelize, tableName: "user", timestamps: false }',
      ');',
      '',
    ],
  ],
  [
    'Drizzle',
    Language.Drizzle,
    [
      '',
      'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
      '',
      'export const User = mysqlTable("user", {',
      '  createdAt: int("created_at").notNull(),',
      '});',
      '',
    ],
  ],
  [
    'DBML',
    Language.DBML,
    ['', 'Table "user" {', '  "created_at" INT [not null]', '}', ''],
  ],
  ['AML', Language.AML, ['', 'user', '  created_at INT', '']],
  [
    'Mermaid',
    Language.Mermaid,
    ['', 'erDiagram', '  "user" {', '    INT created_at', '  }', ''],
  ],
  [
    'PHP',
    Language.PHP,
    [
      '<?php',
      '',
      'declare(strict_types=1);',
      '',
      'class User',
      '{',
      '    public int $createdAt;',
      '}',
      '',
    ],
  ],
  [
    'Doctrine',
    Language.Doctrine,
    [
      '<?php',
      '',
      'declare(strict_types=1);',
      '',
      'use Doctrine\\DBAL\\Types\\Types;',
      'use Doctrine\\ORM\\Mapping as ORM;',
      '',
      '#[ORM\\Entity]',
      "#[ORM\\Table(name: '`user`')]",
      'class User',
      '{',
      "    #[ORM\\Column(name: 'created_at', type: Types::INTEGER)]",
      '    public int $createdAt;',
      '}',
      '',
    ],
  ],
  [
    'Rust',
    Language.Rust,
    [
      '',
      '#[derive(Debug, Clone, PartialEq)]',
      'pub struct User {',
      '    pub createdAt: i32,',
      '}',
      '',
    ],
  ],
  [
    'Swift',
    Language.Swift,
    [
      '',
      'import Foundation',
      '',
      'nonisolated struct User: Codable, Hashable, Sendable {',
      '    var createdAt: Int32',
      '',
      '    enum CodingKeys: String, CodingKey {',
      '        case createdAt = "created_at"',
      '    }',
      '}',
      '',
    ],
  ],
  [
    'Zod',
    Language.Zod,
    [
      '',
      'import * as z from "zod";',
      '',
      'export const UserSchema = z.object({',
      '  createdAt: z.int32(),',
      '});',
      'export type User = z.infer<typeof UserSchema>;',
      '',
    ],
  ],
];

// The one-table view is what a SeaORM module file holds, the module body the
// whole document wraps in pub mod, so SeaORM is checked apart from the rest.
const SEAORM_ENTITY = [
  'use sea_orm::entity::prelude::*;',
  '',
  '#[sea_orm::model]',
  '#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]',
  '#[sea_orm(table_name = "user")]',
  'pub struct Model {',
  '    pub created_at: i32,',
  '}',
  '',
  'impl ActiveModelBehavior for ActiveModel {}',
];

// A JSON Schema text keys each table under $defs, while one table is a schema
// of its own with $schema at its top, so JSON Schema is checked apart too.
const JSON_SCHEMA_ROW = [
  '"title": "User",',
  '"type": "object",',
  '"properties": {',
  '  "createdAt": {',
  '    "type": "integer",',
  '    "minimum": -2147483648,',
  '    "maximum": 2147483647',
  '  }',
  '},',
  '"required": ["createdAt"],',
  '"additionalProperties": false',
];

const JSON_SCHEMA_DIALECT =
  '"$schema": "https://json-schema.org/draft/2020-12/schema",';

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

    it('wraps the SeaORM entity of each table in its module', () => {
      const { state } = createFixture();
      state.settings.language = Language.SeaORM;

      expect(createGeneratorCode(state).split('\n')).toEqual([
        '',
        'pub mod user {',
        ...SEAORM_ENTITY.map(line => (line === '' ? '' : `    ${line}`)),
        '}',
        '',
      ]);
    });

    it('keys the JSON Schema of each table under $defs', () => {
      const { state } = createFixture();
      state.settings.language = Language.JSONSchema;

      expect(createGeneratorCode(state).split('\n')).toEqual([
        '',
        '{',
        `  ${JSON_SCHEMA_DIALECT}`,
        '  "$defs": {',
        '    "User": {',
        ...JSON_SCHEMA_ROW.map(line => `      ${line}`),
        '    }',
        '  }',
        '}',
        '',
      ]);
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

    it('writes the SeaORM entity of one table as its module file', () => {
      const { state, table } = createFixture();
      state.settings.language = Language.SeaORM;

      expect(createGeneratorCodeTable(state, table).split('\n')).toEqual([
        '',
        ...SEAORM_ENTITY,
        '',
      ]);
    });

    it('writes the JSON Schema of one table as a schema of its own', () => {
      const { state, table } = createFixture();
      state.settings.language = Language.JSONSchema;

      expect(createGeneratorCodeTable(state, table).split('\n')).toEqual([
        '',
        '{',
        `  ${JSON_SCHEMA_DIALECT}`,
        ...JSON_SCHEMA_ROW.map(line => `  ${line}`),
        '}',
        '',
      ]);
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
