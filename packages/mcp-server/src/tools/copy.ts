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
  'Edits erd-editor ERD documents (.erd.json) one operation per tool. Find ids with erd_list, which also gives each table its position and size, and read columns and other details with erd_get; then pass the ids to the edit tools, several at once with erd_batch, such as a table with its columns. On a schema of hundreds or thousands of tables erd_list answers a page at a time: find the tables a task needs with its query or namesOnly, then read just those with erd_get or erd_read sql. Tables and columns also take a logical name: erd_set_table_logical_name and erd_set_column_logical_name write it and derive from the word, term and domain dictionaries the physical name and a column’s domain, unless a name that is not empty was set by hand; erd_list_checks lists what the dictionaries find wrong, and erd_derive_physical_names derives names again after a word or term changed. Never write a document file yourself. When an editor serves the document (the ERD Editor extension in VS Code, or its plugin in Obsidian or a JetBrains IDE), edits appear live in its ERD editor: VS Code keeps them unsaved until erd_save, while Obsidian and JetBrains IDEs save them as they save the user’s edits and erd_save writes them at once. Otherwise they are written to the file at once, and each edit’s result says saved: true.';

const TABLE_ID = 'Table id, from erd_list or the createdIds of erd_add_table.';
const COLUMN_ID =
  'Column id in that table, from erd_get or the createdIds of erd_add_column.';
const INDEX_ID = 'Index id, from erd_list or the createdIds of erd_add_index.';
const INDEX_COLUMN_ID =
  'Index column id: an entry of the index columns list erd_get gives, not the table column id.';
const X = 'Left edge on the canvas, in pixels.';
const Y = 'Top edge on the canvas, in pixels.';
const RELATIONSHIP_TYPE =
  'Cardinality at the child end: ZeroOne (0..1), ZeroN (0..N), OneOnly (exactly 1) or OneN (1..N).';
const OLDER_EDITOR =
  'An ERD Editor extension or plugin released before referential actions ignores this setting, so the user should update it.';
const REFERENTIAL_ACTION = `What the database does to the child rows: none (no clause, the database default), noAction, cascade, setNull, setDefault or restrict. A vendor that lacks the action drops it from its DDL. ${OLDER_EDITOR}`;
const COLOR =
  'CSS hex color such as #3b82f6; an empty string removes the color.';
const OLDER_EDITOR_GROUPS =
  'An ERD Editor extension or plugin released before table groups ignores this edit and drops every group when it saves, so the user should update it.';
const OLDER_EDITOR_GROUP_MOVE =
  'An ERD Editor extension or plugin released before table groups moves only the tables of the group and drops every group when it saves, so the user should update it.';
const OLDER_EDITOR_GROUPS_IMPORT =
  'An ERD Editor extension or plugin released before table groups drops every group when it saves, so the user should update it.';
const OLDER_EDITOR_DICTIONARY =
  'An ERD Editor extension or plugin released before dictionaries, logical names and domains ignores what this edit writes of them and leaves them out when it saves, so the user should update it.';
const NO_UNDO =
  'erd_undo cannot revert it: the editor keeps no undo entry for this setting.';

/** The fields of one erd_batch operation, which no tool takes as an argument of its own. */
export const BATCH_FIELD_COPY = {
  tool: 'An erd_ edit tool, such as erd_add_column.',
  as: 'A name for the ids this operation creates, which a later operation passes as $name, $name.1 or $name.last.',
  args: 'The tool arguments without path; where one takes an entity id, $name refers to an earlier operation.',
} as const;

/** Arguments that mean the same in every tool that takes them. */
export const ARG_COPY: Readonly<Record<string, string>> = {
  path: 'Path of the ERD document (.erd.json, .erd, .vuerd), absolute or relative to the working directory.',
  tableId: TABLE_ID,
  columnId: COLUMN_ID,
  memoId: 'Memo id, from erd_list or the createdIds of erd_add_memo.',
  indexId: INDEX_ID,
  indexColumnId: INDEX_COLUMN_ID,
  groupId:
    'Table group id, from erd_list or the createdIds of erd_add_table_group.',
  relationshipId: 'Relationship id, from erd_list or createdIds.',
  relationshipType: RELATIONSHIP_TYPE,
  onDelete: REFERENTIAL_ACTION,
  onUpdate: REFERENTIAL_ACTION,
  color: COLOR,
  x: X,
  y: Y,
  mode: 'replace, the default, loads the import in place of every table, relationship, index, memo and table group and keeps the settings but the view, which goes to the start of the canvas, and keeps the word, term and domain dictionaries; append adds what the import holds as new tables below the diagram and keeps everything already there, a table of the same name included.',
  wordId: 'Word id, from erd_list or the createdIds of erd_add_word.',
  termId: 'Term id, from erd_list or the createdIds of erd_add_term.',
  domainName:
    'A domain by its name instead of domainId, trimmed and compared in its case, as the editor compares names; an empty string for none.',
  abbreviation:
    'What the word writes into a physical name, such as MBR for Member.',
  englishName: 'The English name of the word.',
  forbiddenWords: 'Words that must not be used in its place, comma separated.',
  synonyms: 'Other spellings of it, comma separated.',
  physicalName:
    'The physical name the term gives a table or column; empty, the words compose one.',
  category: 'The group the domain belongs to, such as Number or Text.',
  dataType:
    'The data type every column linking the domain takes, such as INT or VARCHAR(255).',
  description: 'What it means, for whoever reads the dictionary.',
};

const DICTIONARY_NAME =
  'A name another row of the same dictionary holds is refused.';
const TERM_DOMAIN_ID =
  'Domain id the term gives a column, from erd_list or the createdIds of erd_add_domain; null or an empty string for none.';
const DOMAIN_ID =
  'Domain id, from erd_list or the createdIds of erd_add_domain.';
const SYNC_UNLINK =
  "A column the sync reaches whose new type differs from its own domain's is unlinked from that domain.";

const setting = (subject: string, value: string): ToolCopy => ({
  description: `Sets ${subject}. ${NO_UNDO}`,
  args: { value },
});

const flag = (subject: string): ToolCopy => ({
  description: `Sets whether the column is ${subject}. Setting the value it already has changes nothing.`,
  args: { value: `True to make the column ${subject}, false to clear it.` },
});

const importer = (language: string, more = ''): ToolCopy => ({
  description: `Replaces every table, relationship, index, memo and table group of the document with the schema parsed from ${language}, keeping its settings but the view, which goes to the start of the canvas, and keeping its word, term and domain dictionaries; erd_undo restores what it replaced. With mode append it instead adds the schema's tables, relationships and indexes as new ones in a grid below the diagram, leaving every table and setting already there as it is; a foreign key to a table the text does not declare is dropped.${more}`,
  args: { value: `The ${language} source text.` },
});

export const TOOL_COPY: Readonly<Record<string, ToolCopy>> = {
  erd_list_documents: {
    description:
      "Lists ERD documents with path, open, active, dirty and readonly. With an editor serving the working directory (the VS Code extension, the Obsidian plugin or the JetBrains IDE plugin) it lists that editor's, every open project's in a JetBrains IDE; otherwise the ERD files under the working directory.",
  },
  erd_open_document: {
    description:
      'Opens a document for editing, in the ERD editor of the editor that serves it, if one does (the VS Code extension, the Obsidian plugin or the JetBrains IDE plugin). With create it makes the file first if missing; a name with no extension gets .erd.json.',
    args: {
      create: 'True to create an empty document when the file does not exist.',
    },
  },
  erd_read: {
    description:
      "Reads a document as a snapshot, as DDL, as its raw JSON or, with the scripts format, its before and after scripts alone. The sql format of the whole document includes the document's before and after scripts. The sql format with tableIds, tableNames or groupNames gives the DDL of just those tables, the way to read a large schema; a read too large for one answer is refused with how to narrow it. For ids and details prefer erd_list and erd_get. Change a document only through the erd_ tools, never by writing its file.",
    args: {
      format:
        "snapshot: compact JSON with every id, column, table group and dictionary row, large on a big schema. sql: DDL of a vendor. json: the whole raw .erd.json document, larger still; never write this into the file. scripts: just the document's before and after scripts, as JSON { before, after }, each empty when unset, whatever the size of the schema.",
      vendor:
        'Database for the sql format; defaults to the database the document is set to.',
      statements:
        'For the sql format: create (default), ifNotExists, which writes CREATE TABLE IF NOT EXISTS on MySQL, MariaDB, PostgreSQL, SQLite and Databricks and falls back to create elsewhere, or recreate, which drops the tables first (Snowflake writes CREATE OR REPLACE TABLE).',
      header:
        "For the sql format: none (default), use, which selects the database or schema the document's database name gives, or createAndUse, which creates it first. Oracle has use alone, so createAndUse writes use there; PostgreSQL has createAndUse alone, so use writes no header there; SQLite has neither and writes none. No header is written while the database name is empty or not a plain identifier.",
      logicalNameAsComment:
        'For the sql format: true writes the logical name of a table or column whose comment is empty as its comment, keeping every comment that is not empty; false (default) writes no logical name.',
      tableIds:
        'For the sql format: the DDL of these tables only, with the foreign keys they hold, which name the tables they reference.',
      tableNames:
        'For the sql format: tables by name, in any case, as tableIds takes them by id.',
      groupNames:
        'For the sql format: the tables of these table groups, by group name in any case, joined with tableIds and tableNames.',
    },
  },
  erd_list: {
    description:
      'Lists a document: its settings and counts, then a page of tables, each with its id, position and size on the ERD canvas (the width approximate, the height exact), with their indexes and relationships (each relationship once, with one of its tables) and, for a table in a table group or with a logical name, its groupId or logicalName; after the tables come the table groups, the memos, then the rows of the domain, term and word dictionaries, each with its name and what it gives a physical name or column. A small schema fits in one page. On a larger one, nextOffset and note say how to go on: query finds tables by a word, namesOnly lists every table name in a call or a few. Columns, comments, memo text, the tables of a group and every field of a dictionary row come from erd_get; the foreign keys a table holds, from erd_read sql with tableNames.',
    args: {
      query:
        'Words to look for inside table names, logical names and comments and column names, logical names and comments, in any case; tables whose names or logical names hold more of the words come first. Dictionary rows are not searched.',
      offset:
        'Where the page starts in the list, 0 by default; pass the nextOffset of the page before, with the same query.',
      limit:
        'At most this many entries in the page, 100 by default and no limit with namesOnly; a page also stops where one answer is full.',
      namesOnly:
        'True for the table names alone, as many as one answer holds; erd_get and erd_read take tableNames.',
    },
  },
  erd_get: {
    description:
      'Gives the entities named, in full: tables with their columns and size, relationships with their columns, indexes with their columns, memos with their text, table groups with their tables, and words, terms and domains with every field. Ids and names that name nothing live are listed in missing; ids one answer has no room for are listed in notReturned, to ask for again.',
    args: {
      tableIds: 'Table ids, from erd_list.',
      tableNames:
        'Table names, in any case, from erd_list; a name gives every table so named.',
      relationshipIds: 'Relationship ids, from erd_list.',
      indexIds: 'Index ids, from erd_list.',
      memoIds: 'Memo ids, from erd_list.',
      tableGroupIds: 'Table group ids, from erd_list.',
      wordIds: 'Word ids, from erd_list.',
      termIds: 'Term ids, from erd_list.',
      domainIds: 'Domain ids, from erd_list.',
    },
  },
  erd_list_checks: {
    description:
      "Lists what the word, term and domain dictionaries find, as the Checks sheet of the editor's Dictionary tab does, and changes nothing. Errors: a name two rows of one dictionary share, a link to a domain the document does not list, a forbidden word in a logical name or a term's name. Warnings: a word no dictionary lists, a synonym used for a standard word, each in a logical name or a term's name, a physical name other than the one the term of its logical name gives, a column type other than its domain's. Each check names its target (a table, a column with its table, or a word, term or domain row) with its names, the field read, the text found and, where the dictionaries have them, the suggestions to use instead, and counts gives each code's total. The words, terms and domains come first in sheet order, then each table and its columns in document order. With no dictionary row nothing is checked. A long list comes a page at a time: pass nextOffset, or list again from offset 0 after fixing some, since a fixed check leaves the list.",
    args: {
      level: 'error or warning for that level alone; both by default.',
      tableIds:
        'Only the checks of these tables and their columns, from erd_list; dictionary rows are left out.',
      tableNames: 'As tableIds, by table name in any case.',
      offset:
        'Where the page starts in the list, 0 by default; pass the nextOffset of the page before, with the same filters.',
      limit:
        'At most this many checks in the page, 100 by default; a page also stops where one answer is full.',
    },
  },
  erd_batch: {
    description:
      'Runs several edit tools in order as one edit, all or none: they are tried on a copy first, so a refusal names the operation and leaves the document as it was. One erd_undo reverts the whole batch. Name an operation with as, then pass $name for its first created id, $name.1 for its second or $name.last for its last, where a later operation takes an entity id.',
    args: {
      operations:
        'The edit tool calls to run, at most 100, each { tool, as, args }.',
    },
  },
  erd_save: {
    description:
      'Saves a document an editor holds to disk. VS Code keeps edits unsaved until this is called; Obsidian and JetBrains IDEs save them as they save the user’s edits, and this writes them at once. On disk, with no editor, edits are written at once and this does nothing.',
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
    description:
      'Renames a table. The name is then its own: nameDerived goes off, so a later logical name leaves a name that is not empty as it is.',
    args: { value: 'The new table name.' },
  },
  erd_change_table_comment: {
    description: 'Sets the comment of a table.',
    args: { value: 'The comment; an empty string clears it.' },
  },
  erd_set_table_logical_name: {
    description: `Sets the logical name of a table. While its physical name is empty or derived, the dictionaries derive it as erd_set_column_logical_name does, a term giving no domain to a table. ${OLDER_EDITOR_DICTIONARY}`,
    args: { value: 'The logical name; an empty string clears it.' },
  },
  erd_change_table_color: {
    description: 'Sets the color of a table.',
  },
  erd_move_table: {
    description: 'Moves a table to an absolute canvas position.',
  },
  erd_move_tables: {
    description:
      'Moves several tables to absolute canvas positions in one edit, which one erd_undo reverts. Plan the layout from the positions and sizes erd_list gives.',
    args: {
      positions:
        'One entry per table: its tableId from erd_list, with x and y, the left and top edges in pixels. Each table at most once.',
    },
  },
  erd_sort_tables: {
    description:
      "Arranges every table on the canvas automatically, as the editor sort command does: the tables of a table group stay together and the group's rect is fitted round them, which tables it holds unchanged.",
  },

  erd_add_column: {
    description:
      'Adds an empty column to a table and returns its id in createdIds. Set it with the erd_change_column_ and erd_set_column_ tools.',
  },
  erd_remove_columns: {
    description:
      'Removes columns from one table, with the relationships and index entries that use them.',
    args: { columnIds: 'Column ids in that table, from erd_get.' },
  },
  erd_change_column_data_type: {
    description:
      "Sets the data type of a column, such as INT or VARCHAR(255). With relationship data type sync on, the change spreads along relationships both ways: into the foreign keys that copy the column, a serial type as the integer it stores (as erd_add_relationship copies it), and from a foreign key back to the key it copies, except a serial key, which keeps its type and stops the change there. A column linked to a dictionary domain is unlinked from it when set to another type than the domain's, and so is any column the sync reaches, a foreign key or the key it copies, whose new type differs from its own domain's.",
    args: { value: 'The data type text.' },
  },
  erd_change_column_name: {
    description:
      'Renames a column. The name is then its own: nameDerived goes off, so a later logical name leaves a name that is not empty as it is.',
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
  erd_set_column_logical_name: {
    description: `Sets the logical name of a column. While its physical name is empty or derived, the dictionaries derive it: a term of that name gives its physical name and links its domain, otherwise the words of the name compose one, their abbreviations joined with underscores. A physical name written by hand stays, and a name another column of the table holds is not given again. The domain a term links gives the column its data type, spread along relationships while relationship data type sync is on. ${SYNC_UNLINK} ${OLDER_EDITOR_DICTIONARY}`,
    args: { value: 'The logical name; an empty string clears it.' },
  },
  erd_set_column_domain: {
    description: `Links a column to a dictionary domain, which gives it the domain's data type, spread along relationships while relationship data type sync is on; null or an empty name unlinks it and keeps its type. ${SYNC_UNLINK} ${OLDER_EDITOR_DICTIONARY}`,
    args: {
      domainId:
        'Domain id to link, from erd_list or the createdIds of erd_add_domain; null or an empty string unlinks.',
    },
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
      "Relates two tables: copies the parent primary key into the child as foreign key columns, creating an unnamed primary key column first if the parent has none (its foreign key column is unnamed too). Each foreign key column is named from its key: a key of one word, only letters and digits with no camelCase break and no switch between cased letters and caseless ones such as Hangul or kana (id, ID, uuid, id2), gets the parent table and an underscore in front (users_id for the key id of users), any other key (member_id, userId, UserID, 회원ID, _id, order-no) or one equal to the table name stays as it is, and a name the child already has is numbered (users_id_2). Each foreign key column copies the data type of its key, but a serial key gives the integer it stores: serial4 integer, smallserial and serial2 smallint, bigserial and serial8 bigint, and a bare serial integer under PostgreSQL, bigint unsigned under MySQL and MariaDB and serial elsewhere, written in capitals when the type of the key is. Each foreign key column also takes the logical name of its key, whatever name it gets, and links the dictionary domain its key links, unless a serial key gives it another type than the domain's. Name the parent table first: an unnamed parent gives the key name alone (id), and a later rename leaves these names as they are. createdIds holds, in order, that new parent key column if one was made, the foreign key columns, then the relationship id last.",
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
  erd_change_relationship_on_delete: {
    description: `Sets the ON DELETE action of a relationship: what deleting a parent row does to its child rows. ${OLDER_EDITOR}`,
  },
  erd_change_relationship_on_update: {
    description: `Sets the ON UPDATE action of a relationship: what changing a parent key does to its child rows. ${OLDER_EDITOR}`,
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

  erd_add_table_group: {
    description: `Adds a table group, a named box drawn behind its tables, and returns its id in createdIds. Pass tableIds to wrap those tables, each leaving any group it was in, or a rect (x, y, width and height), which takes in every table in no group whose centre lies inside it, as drawing a group in the editor does. A table is in one group at most. ${OLDER_EDITOR_GROUPS}`,
    args: {
      name: 'The group name; an empty string leaves it unnamed.',
      color:
        'CSS hex color for its box and the headers of its tables, as erd_change_table_group_color sets it; left out or empty, it has none.',
      x: 'Left edge of the rect on the canvas, in pixels.',
      y: 'Top edge of the rect on the canvas, in pixels.',
      width: 'Width of the rect in pixels, at least 160.',
      height:
        'Height of the rect in pixels, at least 100, the title bar included.',
      tableIds:
        'Table ids, from erd_list, to put in the group instead of a rect; the rect becomes their bounds with padding around them.',
    },
  },
  erd_remove_table_group: {
    description: `Removes a table group; its tables stay where they are, in no group. ${OLDER_EDITOR_GROUPS}`,
  },
  erd_change_table_group_name: {
    description: `Renames a table group. ${OLDER_EDITOR_GROUPS}`,
    args: { value: 'The new name; an empty string leaves it unnamed.' },
  },
  erd_change_table_group_color: {
    description: `Sets the color of a table group, which its box and the headers of its tables take. ${OLDER_EDITOR_GROUPS}`,
  },
  erd_move_table_group: {
    description: `Moves a table group so its rect starts at an absolute canvas position, its tables by the same step. Moving a table or a group never changes which tables a group holds. A move under 20 pixels in all makes no undo entry. ${OLDER_EDITOR_GROUP_MOVE}`,
  },
  erd_resize_table_group: {
    description: `Sets the rect of a table group, its tables staying where they are; the editor draws the box grown to hold each of them. It is refused smaller than 160 by 100 or than the tables with their padding, naming the box the rect must hold. ${OLDER_EDITOR_GROUPS}`,
    args: {
      x: 'New left edge in pixels; left out, it stays.',
      y: 'New top edge in pixels; left out, it stays.',
      width: 'New width in pixels, at least 160.',
      height: 'New height in pixels, at least 100.',
    },
  },
  erd_set_table_group: {
    description: `Puts tables in a table group, each leaving any group it was in, or with groupId null takes them out of their groups. Tables already where they go are left alone. ${OLDER_EDITOR_GROUPS}`,
    args: {
      tableIds: 'Table ids, from erd_list.',
      groupId:
        'Table group id to put the tables in, from erd_list; null or an empty string takes them out of every group.',
    },
  },

  erd_add_word: {
    description: `Adds a word to the word dictionary, the standard words a logical name is composed of, and returns its id in createdIds. ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: { name: 'The word as a logical name spells it, such as Member.' },
  },
  erd_update_word: {
    description: `Changes the fields of a word that the call passes and leaves the rest; values it already holds change nothing. ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: { name: 'The new spelling of the word.' },
  },
  erd_remove_word: {
    description: `Removes a word from the word dictionary; the names it composed stay as they are. ${OLDER_EDITOR_DICTIONARY}`,
  },
  erd_add_term: {
    description: `Adds a term, a logical name with the physical name and the domain it gives, and returns its id in createdIds. Without a physical name the words compose one. ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: {
      name: 'The logical name the term matches, such as Member Number.',
      domainId: TERM_DOMAIN_ID,
    },
  },
  erd_update_term: {
    description: `Changes the fields of a term that the call passes and leaves the rest; values it already holds change nothing. The tables and columns named from it keep their names and domains. ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: {
      name: 'The new logical name of the term.',
      domainId: TERM_DOMAIN_ID,
    },
  },
  erd_remove_term: {
    description: `Removes a term; the tables and columns named from it keep their names and domains. ${OLDER_EDITOR_DICTIONARY}`,
  },
  erd_add_domain: {
    description: `Adds a domain, a named data type columns link to, and returns its id in createdIds. ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: { name: 'The domain name, such as Identifier.' },
  },
  erd_update_domain: {
    description: `Changes the fields of a domain that the call passes and leaves the rest; values it already holds change nothing. A new data type reaches every column linking the domain, and along relationships while relationship data type sync is on. ${SYNC_UNLINK} ${DICTIONARY_NAME} ${OLDER_EDITOR_DICTIONARY}`,
    args: { domainId: DOMAIN_ID, name: 'The new domain name.' },
  },
  erd_remove_domain: {
    description: `Removes a domain; the columns linking it keep their data type and show no domain. ${OLDER_EDITOR_DICTIONARY}`,
    args: { domainId: DOMAIN_ID },
  },
  erd_derive_physical_names: {
    description: `Derives physical names again from the logical names, as the editor's Derive Physical Names Again does. Each covered table or column with a logical name goes back under the dictionaries, its nameDerived on, and takes the name they give now, a physical name written by hand included: a term's physical name and, for a column, its domain, else the words' composition. A name with no logical name stays as it is, and so does a column whose new name another column of its table holds or took first, such as a second foreign key to one table or a role name. Changing a word's abbreviation or a term's physical name leaves the names given before as they are, so call this after one; a term's own physical name is never composed again, so update the term first. One erd_undo reverts the call. ${OLDER_EDITOR_DICTIONARY}`,
    args: {
      scope:
        'column for one column, table for a table name and all its columns, document for every table.',
      tableId:
        'Table id, from erd_list; scope table and column take it, scope document none.',
      columnId:
        'Column id in that table, from erd_get; scope column alone takes it.',
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
  erd_set_ddl_script: {
    description:
      "Sets one of the two SQL scripts the document keeps for its Schema SQL: before, written ahead of the tables, such as CREATE EXTENSION or CREATE SCHEMA, or after, written past the generated DDL, such as GRANT or CREATE VIEW. It replaces the whole script, so read the current one first with erd_read format scripts. The text goes as is into the DDL of every database, so write it for the document's database; SQL Server output gets GO after a script that does not end with GO. An empty string removes it. erd_read sql shows it in place. An ERD Editor extension or plugin released before scripts neither shows nor keeps them, so the user should update it.",
    args: {
      position: 'before or after the generated tables.',
      sql: 'The script, at most 10,000 characters; an empty string removes it.',
    },
  },

  erd_import_sql: importer('SQL DDL (CREATE TABLE statements)'),
  erd_import_graphql: importer('a GraphQL SDL'),
  erd_import_dbml: importer(
    'DBML',
    ` Either way a TableGroup becomes a table group of the tables it names, with its name and color, its box round them; a table named by two groups stays in the first, and a group naming no declared table is left out. ${OLDER_EDITOR_GROUPS_IMPORT}`
  ),
  erd_import_aml: importer('AML'),
  erd_import_json: {
    description: `Replaces the whole document, its settings included, with an erd-editor JSON document such as another .erd.json file: the settings and locks it holds take the place of this document's, and one without lockSettings turns every lock on and puts the view at the start of the canvas. To keep this document's settings, start from the text erd_read json gives. erd_undo restores the previous document. With mode append it instead adds that document's tables, relationships, indexes, memos and table groups as new ones below the diagram, apart as the file places them, and keeps this document's settings; the tables bring their logical names and derived flags, but no column links a domain and none of the document's words, terms and domains is added. ${OLDER_EDITOR_GROUPS_IMPORT} ${OLDER_EDITOR_DICTIONARY}`,
    args: {
      value:
        'The .erd.json document text; empty gives an empty document, and is refused with mode append.',
      mode: 'replace, the default, loads the document in place of this one, its settings included; append adds its tables, relationships, indexes, memos and table groups below the diagram, with no domain link on any column and no word, term or domain row, and keeps everything already there, a table of the same name included.',
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
