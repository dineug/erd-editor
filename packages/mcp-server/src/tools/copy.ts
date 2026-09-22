/**
 * The words an agent reads in tools/list, kept here rather than in the engine
 * so they change without an editor release. copy.exhaustive.test.ts holds the
 * table to every tool and argument, orphans included.
 */
export type ToolCopy = {
  description: string;
  /** Prose for an argument that means something particular in this tool. */
  args?: Readonly<Record<string, string>>;
};

/** What the client hands the model once, beside the tool list. */
export const SERVER_INSTRUCTIONS =
  'Edits erd-editor ERD documents (.erd.json) one operation per tool. Read ids with erd_read format snapshot, then pass them to the edit tools; never write a document file yourself. When a VS Code window has the document, edits appear live in its ERD editor and stay unsaved until erd_save; otherwise they are written to the file at once.';

const TABLE_ID =
  'Table id, from erd_read snapshot or the createdIds of erd_add_table.';
const COLUMN_ID =
  'Column id in that table, from erd_read snapshot or the createdIds of erd_add_column.';
const INDEX_ID =
  'Index id, from erd_read snapshot or the createdIds of erd_add_index.';
const INDEX_COLUMN_ID =
  'Index column id: an entry of the index columns list in erd_read snapshot, not the table column id.';
const X = 'Left edge on the canvas, in pixels.';
const Y = 'Top edge on the canvas, in pixels.';
const RELATIONSHIP_TYPE =
  'Cardinality at the child end: ZeroOne (0..1), ZeroN (0..N), OneOnly (exactly 1) or OneN (1..N).';
const COLOR = 'CSS hex color such as #3b82f6.';
const NO_UNDO =
  'erd_undo cannot revert it: the editor keeps no undo entry for this setting.';

/** Arguments that mean the same in every tool that takes them. */
export const ARG_COPY: Readonly<Record<string, string>> = {
  path: 'Path of the ERD document (.erd.json, .erd, .vuerd), absolute or relative to the working directory.',
  tableId: TABLE_ID,
  columnId: COLUMN_ID,
  memoId: 'Memo id, from erd_read snapshot or the createdIds of erd_add_memo.',
  indexId: INDEX_ID,
  indexColumnId: INDEX_COLUMN_ID,
  relationshipId: 'Relationship id, from erd_read snapshot or createdIds.',
  relationshipType: RELATIONSHIP_TYPE,
  color: COLOR,
  x: X,
  y: Y,
};

const setting = (subject: string, value: string): ToolCopy => ({
  description: `Sets ${subject}. ${NO_UNDO}`,
  args: { value },
});

const flag = (subject: string): ToolCopy => ({
  description: `Sets whether the column is ${subject}. Setting the value it already has changes nothing.`,
  args: { value: `True to make the column ${subject}, false to clear it.` },
});

const importer = (language: string): ToolCopy => ({
  description: `Replaces the whole document with the schema parsed from ${language}. Everything in the document is discarded; erd_undo restores it.`,
  args: { value: `The ${language} source text.` },
});

export const TOOL_COPY: Readonly<Record<string, ToolCopy>> = {
  erd_list_documents: {
    description:
      'Lists ERD documents with path, open, active, dirty and readonly. With a VS Code window serving the working directory it lists that window; otherwise the ERD files under the working directory.',
  },
  erd_open_document: {
    description:
      'Opens a document for editing, in the VS Code ERD editor when a window serves it. With create it makes the file first if missing; a name with no extension gets .erd.json.',
    args: {
      create: 'True to create an empty document when the file does not exist.',
    },
  },
  erd_read: {
    description:
      'Reads a document. Use snapshot to edit: compact JSON with every id. Other formats never edit; change a document only through the erd_ tools, never by writing its file.',
    args: {
      format:
        'snapshot: compact JSON with ids, for editing. sql: DDL of a vendor. json: the whole raw .erd.json document, large; use snapshot for editing and never write this into the file.',
      vendor:
        'Database for the sql format; defaults to the database the document is set to.',
    },
  },
  erd_save: {
    description:
      'Saves a document the VS Code editor holds to disk. Edits stay unsaved in the editor until this is called. On disk, with no editor, edits are written at once and this does nothing.',
  },
  erd_undo: {
    description:
      'Reverts the last edit this agent made to the document, never the user’s edits. Calls that made no undo entry are skipped and named.',
  },
  erd_redo: {
    description: 'Applies again the edit erd_undo last reverted.',
  },

  erd_add_table: {
    description:
      'Adds an empty table at a free spot and returns its id in createdIds. Name it with erd_change_table_name.',
  },
  erd_remove_table: {
    description:
      'Removes a table with its columns, indexes and every relationship that touches it.',
  },
  erd_change_table_name: {
    description: 'Renames a table.',
    args: { value: 'The new table name.' },
  },
  erd_change_table_comment: {
    description: 'Sets the comment of a table.',
    args: { value: 'The comment; an empty string clears it.' },
  },
  erd_change_table_color: {
    description: 'Sets the color of a table.',
  },
  erd_move_table: {
    description: 'Moves a table to an absolute canvas position.',
  },
  erd_sort_tables: {
    description:
      'Arranges every table on the canvas automatically, as the editor sort command does.',
  },

  erd_add_column: {
    description:
      'Adds an empty column to a table and returns its id in createdIds. Set it with the erd_change_column_ and erd_set_column_ tools.',
  },
  erd_remove_columns: {
    description:
      'Removes columns from one table, with the relationships and index entries that use them.',
    args: { columnIds: 'Column ids in that table, from erd_read snapshot.' },
  },
  erd_change_column_data_type: {
    description:
      'Sets the data type of a column, such as INT or VARCHAR(255); foreign keys that copy it follow when relationship data type sync is on.',
    args: { value: 'The data type text.' },
  },
  erd_change_column_name: {
    description: 'Renames a column.',
    args: { value: 'The new column name.' },
  },
  erd_change_column_default: {
    description: 'Sets the default value of a column.',
    args: { value: 'The default as SQL text; an empty string clears it.' },
  },
  erd_change_column_comment: {
    description: 'Sets the comment of a column.',
    args: { value: 'The comment; an empty string clears it.' },
  },
  erd_set_column_primary_key: flag('part of the primary key'),
  erd_set_column_unique: flag('unique'),
  erd_set_column_not_null: flag('NOT NULL'),
  erd_set_column_auto_increment: flag('auto increment'),
  erd_move_column: {
    description:
      'Moves a column within its table to the position of another column.',
    args: {
      targetColumnId: 'Column id in the same table whose position it takes.',
    },
  },

  erd_add_relationship: {
    description:
      'Relates two tables: copies the parent primary key into the child as foreign key columns, creating a primary key column first if the parent has none. Returns new column and relationship ids in createdIds.',
    args: {
      startTableId:
        'Parent table id, the referenced side that holds the primary key.',
      endTableId: 'Child table id, which receives the foreign key columns.',
    },
  },
  erd_link_columns: {
    description:
      'Draws a relationship between columns that already exist, such as a foreign key imported from code. Pairs start and end columns by position.',
    args: {
      startTableId: 'Parent table id, the referenced side.',
      startColumnIds: 'Referenced column ids in the parent table.',
      endTableId: 'Child table id, the side holding the foreign key.',
      endColumnIds:
        'Foreign key column ids in the child table, one per start column, in the same order.',
    },
  },
  erd_remove_relationship: {
    description:
      'Removes a relationship line; its foreign key columns stay in the table.',
  },
  erd_change_relationship_type: {
    description: 'Changes the cardinality of a relationship.',
  },

  erd_add_index: {
    description:
      'Adds an empty index to a table and returns its id in createdIds; add columns with erd_add_index_column.',
  },
  erd_remove_index: {
    description: 'Removes an index.',
  },
  erd_change_index_name: {
    description: 'Renames an index.',
    args: { value: 'The new index name.' },
  },
  erd_set_index_unique: {
    description:
      'Sets whether an index is unique. Setting the value it already has changes nothing.',
    args: { value: 'True for a unique index.' },
  },
  erd_add_index_column: {
    description:
      'Adds a column of the index table to the index, returning the new index column id; a column already in the index is left alone.',
    args: { columnId: 'Column id in the table of the index.' },
  },
  erd_remove_index_column: {
    description: 'Removes one column from an index.',
  },
  erd_move_index_column: {
    description:
      'Moves a column within an index to the position of another of its columns.',
    args: {
      targetIndexColumnId:
        'Index column id in the same index whose position it takes.',
    },
  },
  erd_set_index_column_order: {
    description:
      'Sets the sort order of one column in an index. Setting the order it already has changes nothing.',
    args: { orderType: 'ASC or DESC.' },
  },

  erd_add_memo: {
    description:
      'Adds an empty memo note at a free spot and returns its id in createdIds.',
  },
  erd_remove_memo: {
    description: 'Removes a memo.',
  },
  erd_change_memo_value: {
    description: 'Replaces the text of a memo.',
    args: { value: 'The memo text.' },
  },
  erd_change_memo_color: {
    description: 'Sets the color of a memo.',
  },
  erd_move_memo: {
    description: 'Moves a memo to an absolute canvas position.',
  },
  erd_resize_memo: {
    description:
      'Resizes a memo. erd_undo cannot revert it: the editor keeps no undo entry for a single resize.',
    args: {
      width: 'Width in pixels, at least the editor minimum of about 116.',
      height: 'Height in pixels, at least 100.',
    },
  },

  erd_set_database_name: setting(
    'the database name of the document',
    'The database name.'
  ),
  erd_set_database: setting(
    'the database vendor, which picks the data types and the default DDL of erd_read sql',
    'The database vendor.'
  ),
  erd_set_language: setting(
    'the code generation language of the document',
    'The language or framework.'
  ),
  erd_set_table_name_case: setting(
    'the name case used when generating code for table names',
    'The case style.'
  ),
  erd_set_column_name_case: setting(
    'the name case used when generating code for column names',
    'The case style.'
  ),
  erd_set_bracket_type: setting(
    'how generated SQL quotes names',
    'The quote style.'
  ),
  erd_set_relationship_data_type_sync: setting(
    'whether foreign key columns follow the data type of the columns they reference',
    'True to keep them in step.'
  ),
  erd_set_relationship_optimization: setting(
    'the relationship optimization flag stored in the document',
    'True to turn it on.'
  ),
  erd_set_column_order: {
    description: `Sets the order of the column parts shown in a table row by moving one part to the place of another. ${NO_UNDO}`,
    args: {
      columnType: 'The column part to move.',
      targetColumnType: 'The column part whose place it takes.',
    },
  },
  erd_set_max_width_comment: setting(
    'the widest a comment is drawn in a table',
    'Width in pixels, or -1 for no limit.'
  ),
  erd_set_ignore_save_settings: {
    description: `Sets whether a viewport setting is left out of the saved file. ${NO_UNDO}`,
    args: {
      saveSettingType: 'scroll or zoomLevel.',
      value: 'True to leave it out of the file.',
    },
  },
  erd_set_show: {
    description:
      'Shows or hides one part of the diagram, such as column comments or relationship lines. Setting the value it already has changes nothing.',
    args: {
      show: 'The part of the diagram.',
      value: 'True to show it, false to hide it.',
    },
  },

  erd_import_sql: importer('SQL DDL (CREATE TABLE statements)'),
  erd_import_graphql: importer('a GraphQL SDL'),
  erd_import_dbml: importer('DBML'),
  erd_import_aml: importer('AML'),
  erd_import_json: {
    description:
      'Replaces the whole document with an erd-editor JSON document, such as another .erd.json file. erd_undo restores the previous one.',
    args: {
      value: 'The .erd.json document text; empty gives an empty document.',
    },
  },
};

/** The description of a tool, or a thrown error for a tool the table misses. */
export function describeTool(name: string): string {
  const copy = TOOL_COPY[name];
  if (!copy) throw new Error(`tools/copy.ts has no description for ${name}`);
  return copy.description;
}

/** The prose for one argument, the tool's own ahead of the shared entry. */
export function describeArg(tool: string, arg: string): string {
  const prose = TOOL_COPY[tool]?.args?.[arg] ?? ARG_COPY[arg];
  if (!prose) {
    throw new Error(`tools/copy.ts has no prose for ${arg} of ${tool}`);
  }
  return prose;
}
