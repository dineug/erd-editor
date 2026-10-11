# @dineug/erd-editor-mcp

> An MCP server that lets a coding agent edit [ERD Editor](https://github.com/dineug/erd-editor)
> diagrams, live in VS Code, Obsidian or a JetBrains IDE, or straight on disk

Claude Code, Codex and any other client of the
[Model Context Protocol](https://modelcontextprotocol.io) get one tool per editing operation on an
ERD document (an `.erd.json` file, or an `.erd` file in an Obsidian vault): add a table, rename a
column, relate two tables, import a DDL dump, read the schema back as SQL. When VS Code with the
[ERD Editor extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode),
Obsidian with the [ERD Editor plugin](https://community.obsidian.md/plugins/erd-editor) or an
IntelliJ-based IDE with the
[ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) has the document open,
or has open the folder, vault or project that holds it, the agent joins the editor as a
collaborator: every edit shows up on the canvas as it happens, with the agent's focus on the cell
it is editing. With no editor around, the same tools edit the file itself.

![coding agents](https://github.com/dineug/erd-editor/blob/main/img/coding-agents.webp?raw=true)

The package is one self-contained file with no runtime dependencies.

## Install

The server needs Node.js 22.12 or later. `npx` downloads it the first time the agent starts it, so
there is nothing else to install.

Keep ERD Editor and the MCP server up to date together. When one speaks an older hub protocol than
the other, the server refuses to connect and says which one to update.

### Claude Code

Run in your project folder:

```sh
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
```

### Codex

Add to `~/.codex/config.toml`, or to `.codex/config.toml` in a trusted project:

```toml
[mcp_servers.erd-editor]
command = "npx"
args = ["-y", "@dineug/erd-editor-mcp"]
```

### Any other MCP client

Run `npx -y @dineug/erd-editor-mcp` as a stdio server. Start it in your project folder: it resolves
relative document paths against its working directory.

## Live and headless

For every call the server looks, through the lock files in `~/.erd-editor/ide/`, for an editor that
holds the document: a VS Code window with the ERD Editor extension, an Obsidian vault window with
the ERD Editor plugin, or an IntelliJ-based IDE with the ERD Editor plugin, which keeps one lock for
all its open projects.

| What it finds | What an edit does |
| --- | --- |
| A window whose workspace or vault contains the document, an IDE with a project that contains it, or an editor that has it open | **Live.** Opens the document in ERD Editor if needed, as `erd_open_document` does too, without taking the keyboard focus, joins the editing session and applies the change there. Edits appear at once. VS Code keeps them unsaved until the agent calls `erd_save`, you save, or VS Code's Auto Save does; Obsidian saves them about two seconds later and a JetBrains IDE a fraction of a second after editing stops, as each saves your own edits, and `erd_save` writes them at once. The agent's `erd_undo` reverts only its own edits. |
| No editor | **Headless.** Loads the file, applies the change and replaces the file atomically. `erd_save` has nothing to do. A read-only file, such as a Perforce or TFVC file not checked out, is refused with `readonly` until you make it writable. On Windows, a file with permissions of its own, unlike its folder's, is written in place, not atomically, so that it keeps them; a program reading it at that moment can find it half written. A file another program holds open is tried again for up to two seconds. |
| An editor whose hub is off or failed to start | **Refused.** Reads still come from disk, but the server never writes the file behind the editor, where its next save would overwrite the change. |
| An editor whose hub speaks another protocol than this server | **Refused**, reads included; the message names the side to update, the ERD Editor extension or plugin, or this server. |
| On Windows, an editor that holds the document under another path to the same file: the agent named it through a network share or a mapped drive of this computer, such as `\\localhost\C$\…`, and the editor opened it by its drive path, or the other way round | **Refused**, reads included; the result names the path the editor holds the document by, to call again with. |
| An editor Windows keeps the agent out of: one started as administrator while the agent was not, or any editor when the agent runs in a sandbox | **Refused**, reads included, with a result that says why. Run the editor and the agent with the same rights, for example by starting the editor again without administrator rights. With Windows 11's Administrator protection on, an editor started as administrator runs as a separate account whose lock files the agent never sees, so the edit goes headless under that editor: start it without administrator rights there. |

Each editor runs its hub, on by default, as follows:

- **VS Code** — a hub in each window, in a trusted workspace only; the
  `dineug.erd-editor.agentHub.enabled` setting turns it off for the window. An untrusted window, or
  one with the setting off, still guards its documents from headless writes. The extension starts
  once the folder you open holds an `.erd.json` file, or once you open a diagram. In a folder with
  none yet, open or create a diagram in VS Code first; otherwise the agent writes its new diagram on
  disk, and it does not open in the editor.
- **Obsidian** — a hub in each vault window while the ERD Editor plugin is enabled;
  **Settings → ERD Editor → Coding agents** turns it off for the vault, and the vault window
  still guards its files from headless writes.
- **JetBrains IDEs** — one hub for the whole IDE and every project open in it, while the ERD
  Editor plugin is enabled; unticking **Settings | Tools | ERD Editor → Coding agents** turns it
  off for the whole IDE, and the IDE still guards the files of its projects from headless writes. A
  project you have not trusted, opened in safe mode, is kept the same way: agents read its diagrams
  but never change them.

The server never falls back to the file on its own while an editor holds a document: if the
connection drops, it reconnects. Only once that editor has exited, or has closed the document and
stopped serving it, as VS Code does when you close a document from outside its workspace, Obsidian
when the plugin is disabled and a JetBrains IDE when a project closes or the plugin is disabled,
does it edit the file, and it says so in the result.

An editor in a Flatpak sandbox is the exception. Obsidian installed from Flathub and a JetBrains IDE
installed as a Flatpak run in a sandbox the server cannot reach, so they run no hub and write no
lock. There the agent edits the files on disk, even while a diagram is open, unless an editor
outside the sandbox, such as a VS Code window, has the document or a folder that holds it open.
Obsidian picks the change up as it picks up any change made outside it, and an edit of yours it has
not saved yet gives way to the agent's. A JetBrains IDE does not reload a diagram changed on disk
while it is open, and your next edit in it would overwrite the agent's, so close the diagram first.

## Documents

With `create`, `erd_open_document` makes the document first when the file is missing, adding
`.erd.json` to a name with no extension. In an Obsidian vault, name it `.erd`: Obsidian's file
explorer leaves `.erd.json` files out unless **Settings → Files and links → Detect all file
extensions** is on. A file that is not an ERD document the editor can read, such as one left with
merge conflict markers, is refused with `invalidDocument` and left as it is, never loaded as an
empty diagram and written back.

On Windows the server refuses a path with a name Windows would store as another file, a folder's
included: one holding a colon, such as `orders:v2.erd.json`, or another character Windows refuses
(`<`, `>`, `"`, `|`, `?`, `*` or a control character), a device name such as `NUL.erd.json` or
`CON.erd.json`, or a name ending in a dot or a space. It leaves such files and folders out when it
lists documents from disk too. Use `-` in place of `:`.

An agent finds ids with `erd_list`, which lists the settings, the counts and the tables by id, each
with its position and its size on the canvas (the width approximate, the height exact) and the table
group it is in, with their relationships and indexes, then the table groups and the memos. It reads
columns and other details with `erd_get`, then passes those ids to the edit tools. `erd_read`
answers the whole document at once: the `snapshot` format lists every entity with its id, the `sql`
format generates DDL for any of the eight supported databases, and the `json` format is the whole
document in the form a save writes to the file, with any unsaved live edits and a v2 document in its
v3 form. Its `scripts` format answers the document's before and after scripts alone, however large
the schema. Have the agent edit through these tools rather than write the JSON file itself.

The `sql` format writes plain `CREATE TABLE` statements and no header by default. Its `statements`
argument asks for `ifNotExists` (`CREATE TABLE IF NOT EXISTS` on MySQL, MariaDB, PostgreSQL, SQLite
and Databricks) or `recreate` (the tables dropped first, `CREATE OR REPLACE TABLE` on Snowflake),
and its `header` for `use`, which selects the database or schema the document's database name
gives, or `createAndUse`, which creates it first. As the options of the editor's Schema SQL tab do,
`ifNotExists` writes plain `CREATE TABLE` on the other databases, `createAndUse` writes `use` on
Oracle, which has `use` alone, `use` writes no header on PostgreSQL, which has `createAndUse` alone,
and SQLite writes no header; no database writes one while the name is empty or not a plain
identifier. The DDL of the whole document carries the document's before and after scripts; the DDL
of some tables carries none.

Schemas of hundreds or thousands of tables work too. A read answers at most 40,000 characters, under
the point where Claude Code sets a tool result aside in a file; only `erd_get` goes past it, when
the first entity it answers is larger on its own, which it gives whole with a note. `erd_list`
answers a page of 100 tables and says where the next one starts; its `query` finds tables by a word
in a table or column name or comment, and `namesOnly` lists the table names alone, 2,000 short names
in one answer. `erd_get` and `erd_read` take `tableNames` as well as ids, and `erd_read` takes
`groupNames`, the tables of those table groups, so an agent asked for a SQL query on a large schema
reads the DDL of just the tables it needs. `erd_read` refuses a read too large for one answer and
says how to narrow it. `erd_get` answers the entities that fit and lists the ids it had no room for
under `notReturned`, to ask for again, and refuses only a request for more ids than one answer can
name.

## Tools

| Group | Tools |
| --- | --- |
| Session | `erd_list_documents`, `erd_open_document`, `erd_list`, `erd_get`, `erd_read`, `erd_save`, `erd_undo`, `erd_redo` |
| Tables | `erd_add_table`, `erd_remove_table`, `erd_change_table_name`, `erd_change_table_comment`, `erd_change_table_color`, `erd_move_table`, `erd_move_tables`, `erd_sort_tables` |
| Columns | `erd_add_column`, `erd_remove_columns`, `erd_change_column_name`, `erd_change_column_data_type`, `erd_change_column_default`, `erd_change_column_comment`, `erd_set_column_primary_key`, `erd_set_column_unique`, `erd_set_column_not_null`, `erd_set_column_auto_increment`, `erd_move_column` |
| Relationships | `erd_add_relationship`, `erd_link_columns`, `erd_remove_relationship`, `erd_change_relationship_type`, `erd_change_relationship_on_delete`, `erd_change_relationship_on_update` |
| Indexes | `erd_add_index`, `erd_remove_index`, `erd_change_index_name`, `erd_set_index_unique`, `erd_add_index_column`, `erd_remove_index_column`, `erd_move_index_column`, `erd_set_index_column_order` |
| Memos | `erd_add_memo`, `erd_remove_memo`, `erd_change_memo_value`, `erd_change_memo_color`, `erd_move_memo`, `erd_resize_memo` |
| Table groups | `erd_add_table_group`, `erd_remove_table_group`, `erd_change_table_group_name`, `erd_change_table_group_color`, `erd_move_table_group`, `erd_resize_table_group`, `erd_set_table_group` |
| Settings | `erd_set_database`, `erd_set_database_name`, `erd_set_ddl_script` |
| Import | `erd_import_sql`, `erd_import_graphql`, `erd_import_dbml`, `erd_import_aml`, `erd_import_json` |
| Batch | `erd_batch` |

`erd_batch` runs up to 100 operations of the edit tools in order as one edit, all or none: it tries
them on a copy of the document first, so a refused operation is named and nothing is applied, and
one `erd_undo` reverts the whole batch. An operation named with `as` lets a later one pass `$name`
where it takes an entity id, `$name.1` for its second created id or `$name.last` for its last, such
as a relationship's own id after its key columns, so a table and its columns take one call.

The five import tools replace the document's tables, relationships, indexes, memos and table groups
by default: the four schema imports keep its settings but the view, which goes to the start of the
canvas, and `erd_import_json` takes the settings of the document it loads. With `mode: "append"`
they add the import instead, as the editor's Import and Add does but without its Flow layout: the
tables, relationships and indexes arrive as new ones in a grid below everything already there (a
JSON document's, with its memos and table groups, in the placement it has), the document's settings
and tables stay as they are, and one `erd_undo` takes them away. A foreign key to a table the import
does not declare is dropped. Either way, `erd_import_dbml` reads each `TableGroup` as a table group
of the tables it names, its box round them.

`erd_change_relationship_on_delete` and `erd_change_relationship_on_update`, and the `onDelete` /
`onUpdate` of `erd_add_relationship` and `erd_link_columns`, set a foreign key's ON DELETE and ON
UPDATE actions; a database that lacks one leaves it out of its DDL. An ERD Editor extension or
plugin released before referential actions ignores them when it serves the document, so update it.

A table group is a box drawn behind its tables, with the name and color it is given, and a table is
in one group at most. `erd_add_table_group` wraps the tables it is given, or takes a rect and the
tables in no group whose centre lies inside it, as drawing a group in the editor does.
`erd_move_table_group` moves a group with its tables, and only `erd_add_table_group`,
`erd_set_table_group` and `erd_remove_table_group` change which tables a group holds. An ERD Editor
extension or plugin released before table groups ignores these edits and the groups
`erd_import_dbml` and `erd_import_json` bring, except that it still moves the tables of a group
`erd_move_table_group` moves, and drops every group when it saves, so update it.

An agent sets the database and its name, the settings of the schema itself, and the Schema SQL
scripts. What the diagram shows, the column order, the maximum comment width, the relationship data
type sync, the code generation language, the name cases, the bracket type and the locks that keep
those last three at their saved values in the file are yours to set in the editor; `erd_list` and
`erd_read` read them as the file saves them.

`erd_set_ddl_script` sets the SQL the document keeps before or after the tables of its Schema SQL,
such as `CREATE EXTENSION` ahead of them or `GRANT` past them, written into the DDL as is for every
database (on MSSQL, ended with `GO`), up to 10,000 characters a call. A call replaces the whole
script, an empty string removes it, and `erd_undo` reverts it. The `erd_read` `scripts` format gives
both scripts alone, however large the schema, its snapshot gives them too, and its `sql` format of
the whole document writes them in place. An ERD Editor extension or plugin released before scripts
neither shows nor keeps them when it serves the document, so update it.

Every edit tool takes the document `path`. `erd_set_database`, `erd_set_database_name` and
`erd_resize_memo` make no undo entry in the editor, nor does an `erd_move_table_group` of under 20
pixels in all, so `erd_undo` passes over them, inside an `erd_batch` too, and the result says so. An
`erd_set_column_*`, `erd_set_index_*` or `erd_set_table_group` call that finds the value already set
sends nothing and makes no entry either, and its result says so.

The edit tools and the read tools (`erd_list`, `erd_get`, `erd_read`) refuse an argument they do not
declare, or one of the wrong type, with a JSON-RPC invalid params error (-32602) before touching the
document. `erd_batch` does the same for its own arguments and for an operation's `tool`, `as` and
`args` keys; it checks each operation's own arguments as the batch runs and refuses a bad one with
`invalidArgs`, naming the operation, before anything is applied. Either way a misspelled argument is
never silently dropped. The other session tools ignore arguments they do not know.

## Documentation

- [Introduction](https://docs.erd-editor.io/docs/mcp/introduction) — what an agent can and cannot
  do, how it works, requirements
- [Install](https://docs.erd-editor.io/docs/mcp/installation) — Claude Code, Codex and any other
  client, setting up VS Code, Obsidian or a JetBrains IDE, updating
- [Live and Headless](https://docs.erd-editor.io/docs/mcp/live-and-headless) — where an edit
  lands, saving, undo, a window that goes away, conflicts on disk
- [Tools](https://docs.erd-editor.io/docs/mcp/tools) — every tool with its arguments, paging a
  large schema, `erd_batch`, results and refusals

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE)
