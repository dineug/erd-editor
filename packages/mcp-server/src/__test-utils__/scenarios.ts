import { createImportValue, SEED } from '@/__test-utils__/seed';

/**
 * One call per registry tool that changes every snapshot path it declares on
 * the seed, and a removal cascades into the seed's relationship and index.
 * The registry specs run every tool through it, so a new tool needs one here.
 */
export const TOOL_SCENARIOS: Readonly<Record<string, Record<string, unknown>>> =
  {
    erd_add_table: {},
    erd_remove_table: { tableId: SEED.orders },
    erd_change_table_name: { tableId: SEED.users, value: 'members' },
    erd_change_table_comment: { tableId: SEED.users, value: 'who signs in' },
    erd_change_table_color: { tableId: SEED.users, color: '#ff8800' },
    erd_move_table: { tableId: SEED.users, x: 40, y: 60 },
    erd_sort_tables: {},
    erd_add_column: { tableId: SEED.empty },
    erd_remove_columns: {
      tableId: SEED.orders,
      columnIds: [SEED.orderUser, SEED.orderNote],
    },
    erd_change_column_data_type: {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'BIGINT',
    },
    erd_change_column_name: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'full_name',
    },
    erd_change_column_default: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: "'anonymous'",
    },
    erd_change_column_comment: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'shown to others',
    },
    erd_set_column_primary_key: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: true,
    },
    erd_set_column_unique: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: true,
    },
    erd_set_column_not_null: {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: true,
    },
    erd_set_column_auto_increment: {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: true,
    },
    erd_move_column: {
      tableId: SEED.orders,
      columnId: SEED.orderNote,
      targetColumnId: SEED.orderId,
    },
    // A start table with no key, so the relationship brings one of its own.
    erd_add_relationship: {
      startTableId: SEED.empty,
      endTableId: SEED.users,
      relationshipType: 'ZeroN',
    },
    erd_link_columns: {
      startTableId: SEED.users,
      startColumnIds: [SEED.userId],
      endTableId: SEED.orders,
      endColumnIds: [SEED.orderNote],
      relationshipType: 'OneOnly',
    },
    erd_remove_relationship: { relationshipId: SEED.relationship },
    erd_change_relationship_type: {
      relationshipId: SEED.relationship,
      relationshipType: 'ZeroOne',
    },
    erd_add_index: { tableId: SEED.users },
    erd_remove_index: { indexId: SEED.index },
    erd_change_index_name: { indexId: SEED.index, value: 'orders_note_idx' },
    erd_set_index_unique: { indexId: SEED.index, value: true },
    erd_add_index_column: { indexId: SEED.index, columnId: SEED.orderId },
    erd_remove_index_column: {
      indexId: SEED.index,
      indexColumnId: SEED.indexColumn,
    },
    erd_move_index_column: {
      indexId: SEED.index,
      indexColumnId: SEED.userIndexColumn,
      targetIndexColumnId: SEED.indexColumn,
    },
    erd_set_index_column_order: {
      indexId: SEED.index,
      indexColumnId: SEED.indexColumn,
      orderType: 'DESC',
    },
    erd_add_memo: {},
    erd_remove_memo: { memoId: SEED.memo },
    erd_change_memo_value: { memoId: SEED.memo, value: 'ship on friday' },
    erd_change_memo_color: { memoId: SEED.memo, color: '#336699' },
    erd_move_memo: { memoId: SEED.memo, x: 960, y: 420 },
    erd_resize_memo: { memoId: SEED.memo, width: 320, height: 240 },
    erd_set_database_name: { value: 'shop' },
    erd_set_database: { value: 'PostgreSQL' },
    erd_set_language: { value: 'TypeScript' },
    erd_set_table_name_case: { value: 'snakeCase' },
    erd_set_column_name_case: { value: 'snakeCase' },
    erd_set_bracket_type: { value: 'backtick' },
    erd_set_relationship_data_type_sync: { value: false },
    erd_set_relationship_optimization: { value: true },
    erd_set_column_order: {
      columnType: 'columnComment',
      targetColumnType: 'columnName',
    },
    erd_set_show: { show: 'columnUnique', value: true },
    erd_set_max_width_comment: { value: 120 },
    erd_set_ignore_save_settings: { saveSettingType: 'scroll', value: true },
    erd_import_sql: {
      value:
        'CREATE TABLE accounts (id INT NOT NULL PRIMARY KEY, email VARCHAR(255));',
    },
    erd_import_graphql: {
      value: 'type Account {\n  id: ID!\n  email: String\n}',
    },
    erd_import_dbml: {
      value: 'Table accounts {\n  id int [pk]\n  email varchar\n}',
    },
    erd_import_aml: { value: 'accounts\n  id int pk\n  email varchar' },
    erd_import_json: { value: createImportValue() },
  };
