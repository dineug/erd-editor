import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import { Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/java';

type StateInput = {
  tables?: Table[];
  columns?: Column[];
  settings?: Partial<RootState['settings']>;
};

function createState({
  tables = [],
  columns = [],
  settings,
}: StateInput): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;
  state.doc.tableIds = tables.map(table => table.id);
  tables.forEach(table => {
    state.collections.tableEntities[table.id] = table;
  });
  columns.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  Object.assign(state.settings, settings);
  return state;
}

describe('generator-code/java', () => {
  describe('createCode', () => {
    it('renders every table sorted by name, separated by blank lines', () => {
      const alpha = createTable({ id: 't1', name: 'alpha', columnIds: ['c1'] });
      const zeta = createTable({
        id: 't2',
        name: 'zeta_table',
        comment: 'zeta comment',
        columnIds: ['c2'],
      });
      const state = createState({
        // deliberately out of order so the sort is observable
        tables: [zeta, alpha],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'created_at',
            dataType: 'DATE',
            comment: 'when',
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Data',
        'public class Alpha {',
        '  private Integer id;',
        '}',
        '',
        '// zeta comment',
        '@Data',
        'public class ZetaTable {',
        '  // when',
        '  private LocalDate createdAt;',
        '}',
        '',
      ]);
    });

    it('returns only the leading newline when there are no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('skips table ids that are not in the collection', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'alpha' })],
      });
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Data',
        'public class Alpha {',
        '}',
        '',
      ]);
    });
  });

  describe('formatTable', () => {
    it('maps MySQL data types onto Java types', () => {
      const dataTypes: Array<[string, string, string]> = [
        ['a', 'INT', 'Integer'],
        ['b', 'BIGINT', 'Long'],
        ['c', 'FLOAT', 'Float'],
        ['d', 'DOUBLE', 'Double'],
        ['e', 'DECIMAL', 'BigDecimal'],
        ['f', 'BOOLEAN', 'Boolean'],
        ['g', 'VARCHAR(10)', 'String'],
        ['h', 'TEXT', 'String'],
        ['i', 'DATE', 'LocalDate'],
        ['j', 'TIME', 'LocalTime'],
        ['k', 'UNKNOWN_TYPE', 'String'],
      ];
      const columns = dataTypes.map(([name, dataType]) =>
        createColumn({ id: name, tableId: 't1', name, dataType })
      );
      const table = createTable({
        id: 't1',
        name: 'types',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.MySQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Types {',
        ...dataTypes.map(
          ([name, , javaType]) => `  private ${javaType} ${name};`
        ),
        '}',
      ]);
    });

    it('maps the Oracle TIMESTAMP hint onto LocalDateTime', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'created_at',
        dataType: 'TIMESTAMP',
      });
      const table = createTable({ id: 't1', name: 'log', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [column],
        settings: { database: Database.Oracle },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toContain('  private LocalDateTime createdAt;');
    });

    it('maps the MySQL DATETIME and TIMESTAMP hints onto LocalDateTime', () => {
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'created_at',
          dataType: 'DATETIME',
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'updated_at',
          dataType: 'TIMESTAMP',
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'birth_day',
          dataType: 'DATE',
        }),
      ];
      const table = createTable({
        id: 't1',
        name: 'log',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.MySQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Log {',
        '  private LocalDateTime createdAt;',
        '  private LocalDateTime updatedAt;',
        '  private LocalDate birthDay;',
        '}',
      ]);
    });

    it('maps the PostgreSQL int8 and timestamptz hints past their shorter prefixes', () => {
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'id',
          dataType: 'int8',
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'created_at',
          dataType: 'timestamptz',
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'duration',
          dataType: 'interval',
        }),
      ];
      const table = createTable({
        id: 't1',
        name: 'event',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.PostgreSQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Event {',
        '  private Long id;',
        '  private LocalDateTime createdAt;',
        '  private LocalTime duration;',
        '}',
      ]);
    });

    it('ignores comments that are only whitespace', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'INT',
        comment: '   ',
      });
      const table = createTable({
        id: 't1',
        name: 'blank',
        comment: '  \t ',
        columnIds: ['c1'],
      });
      const state = createState({ tables: [table], columns: [column] });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Blank {',
        '  private Integer id;',
        '}',
      ]);
    });

    it('honours the configured table and column name cases', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'userName',
        dataType: 'VARCHAR',
      });
      const table = createTable({
        id: 't1',
        name: 'user_table',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [column],
        settings: {
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.snakeCase,
        },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class user_table {',
        '  private String user_name;',
        '}',
      ]);
    });

    it('appends to an existing buffer instead of replacing it', () => {
      const table = createTable({ id: 't1', name: 'empty' });
      const state = createState({ tables: [table] });
      const buffer = ['// header'];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '// header',
        '@Data',
        'public class Empty {',
        '}',
      ]);
    });
  });
});
