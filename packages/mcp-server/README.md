# @dineug/erd-editor-mcp

> An MCP server that lets a coding agent edit [erd-editor](https://github.com/dineug/erd-editor)
> diagrams, live in VS Code, Obsidian or a JetBrains IDE, or straight on disk

Claude Code, Codex and any other client of the [Model Context Protocol](https://modelcontextprotocol.io)
get one tool per editing operation on an `.erd.json` document: add a table, rename a column,
relate two tables, import a DDL dump, read the schema back as SQL. When the document is open in
the [ERD Editor VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode),
the [ERD Editor Obsidian plugin](https://community.obsidian.md/plugins/erd-editor) or the
[ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor) for IntelliJ-based IDEs,
the agent joins the editor as a collaborator: every call shows up on the canvas as it happens, with
the agent's focus on the cell it is editing. With no editor around, the same tools edit the file
itself.

![coding agents](https://github.com/dineug/erd-editor/blob/main/img/coding-agents.webp?raw=true)

The package is one self-contained file with no runtime dependencies. It needs Node.js 22.12 or
later.

## Install

### Claude Code

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

Run `npx -y @dineug/erd-editor-mcp` as a stdio server. It resolves relative document paths
against its working directory, so start it in your project.

On Windows it refuses a document name with a colon, such as `orders:v2.erd`, a device name such
as `NUL.erd` or `CON.erd`, or a name ending in a dot or a space, and leaves such files out when it
lists documents from disk: Windows would store another file than the one named. Use `-` in place
of `:`.

## Live and headless

For every edit the server looks for an editor that holds the document, a VS Code window with the
ERD Editor extension, an Obsidian vault window with the ERD Editor plugin or an IntelliJ-based IDE
with the ERD Editor plugin, which keeps one lock for all its open projects, through the lock files
each keeps in `~/.erd-editor/ide/`:

| What it finds | What an edit does |
| --- | --- |
| A window whose workspace or vault contains the document, an IDE with a project that contains it, or an editor that has it open | **Live.** Opens the document in the ERD editor if needed, joins the editing session and applies the change there. Edits appear at once. VS Code keeps them unsaved until the agent calls `erd_save` (or you save); Obsidian saves them about two seconds later and a JetBrains IDE a fraction of a second after editing stops, as each saves your own edits, and `erd_save` writes them at once. The agent's `erd_undo` reverts only its own edits. |
| No editor | **Headless.** Loads the file, applies the change and replaces the file atomically. `erd_save` has nothing to do. A read-only file, such as a Perforce or TFVC file not checked out, is refused with `readonly` until you make it writable. On Windows, a file with permissions of its own, unlike its folder's, is written in place so that it keeps them, and a file another program holds open is tried again for up to two seconds. |
| An editor with its hub off | **Refused.** Reads still work, from disk. Writing the file under an open editor would be overwritten by its next save, so the server does not. |
| On Windows, an editor that holds the document under another path to the same file: the agent named it through a network share or a mapped drive of this computer, such as `\\localhost\C$\…`, and the editor opened it by its drive path, or the other way round | **Refused**, reads included; the result names the path the editor holds the document by, to call again with. |
| An editor Windows keeps the agent out of: one started as administrator while the agent was not, or any editor when the agent runs in a sandbox | **Refused**, reads included, with a result that says why. Run the editor and the agent with the same rights, for example by starting the editor again without administrator rights. With Windows 11's Administrator protection on, an editor started as administrator runs as a separate account whose lock files the agent never sees, so the edit goes headless under that editor: start it without administrator rights there. |

In VS Code the live hub runs in trusted workspaces and is on by default. Turn it off with the
setting `dineug.erd-editor.agentHub.enabled`; the window then still guards its documents from
headless writes. The extension activates in workspaces that contain `.erd`, `.erd.json`, `.vuerd`
or `.vuerd.json` files.

In Obsidian the live hub runs in every vault window while the ERD Editor plugin is enabled, and is
on by default. Turn it off with the plugin's coding-agent setting; the vault window then still
guards its files from headless writes.

In a JetBrains IDE the live hub runs while the ERD Editor plugin is enabled, one for the whole IDE
and every project open in it, and is on by default. Turn it off with Coding agents under
Settings | Tools | ERD Editor; the IDE then still guards the files of its projects from headless
writes. Trust is per project: an agent reads the ERD files of a project the IDE does not trust but
cannot change them. On Windows it listens on a named pipe, as the VS Code and Obsidian hubs do.

The server never falls back to the file on its own while an editor holds a document: if the
connection drops it reconnects, and only when that editor has exited, or has closed the document
and stopped serving it, as Obsidian does when the plugin is disabled and a JetBrains IDE does when
a project closes or the plugin is disabled, does it edit the file and say so in the result.

## Documents

New documents are `.erd.json`: `erd_open_document` with `create` adds the extension to a name that
has none. Existing `.erd`, `.vuerd` and `.vuerd.json` files open too. A file that is not an ERD
document the editor can read, such as one left with merge conflict markers, is refused with
`invalidDocument` and left as it is, never loaded as an empty diagram and written back.

An agent finds ids with `erd_list`, which lists the settings, the counts and the tables by id, each
with its position and its size on the canvas (the width approximate, the height exact), with their
relationships and indexes, then the memos, and reads columns and other details with `erd_get`, then
passes those ids to the edit tools. `erd_read` answers the whole document at once: the
`snapshot` format lists every entity with its id, the `sql` format generates DDL for any of the
eight supported databases and the `json` format is the raw file. Its `scripts` format answers the
document's before and after scripts alone, however large the schema. Editing the JSON file by hand
is not supported.

The `sql` format writes plain `CREATE TABLE` statements and no header by default. Its
`statements` argument asks for `ifNotExists` (`CREATE TABLE IF NOT EXISTS` on MySQL, MariaDB,
PostgreSQL, SQLite and Databricks) or `recreate` (the tables dropped first, `CREATE OR REPLACE
TABLE` on Snowflake), and its `header` for `use`, which selects the database or schema the
document's database name gives, or `createAndUse`, which creates it first. As the options of the
editor's Schema SQL tab do, `ifNotExists` writes plain `CREATE TABLE` on the other databases,
`createAndUse` writes `use` on Oracle, which has `use` alone, `use` writes no header on PostgreSQL,
which has `createAndUse` alone, and SQLite writes no header; no database writes one while the name
is empty or not a plain identifier. The DDL of the whole document carries the document's before
and after scripts; the DDL of some tables carries none.

Schemas of hundreds or thousands of tables work too. A read answers at most 40,000 characters,
under the point where Claude Code sets a tool result aside in a file. `erd_list` answers a page of
100 tables and says where the next one starts; its `query` finds tables by a word in a table or
column name or comment, and `namesOnly` lists the table names alone, 2,000 short names in one
answer. `erd_get` and `erd_read` take `tableNames` as well as ids, so an agent asked for a SQL query
on a large schema reads the DDL of just the tables it needs. A read too large for one answer is
refused with how to narrow it.

## Tools

| Group | Tools |
| --- | --- |
| Session | `erd_list_documents`, `erd_open_document`, `erd_list`, `erd_get`, `erd_read`, `erd_save`, `erd_undo`, `erd_redo` |
| Tables | `erd_add_table`, `erd_remove_table`, `erd_change_table_name`, `erd_change_table_comment`, `erd_change_table_color`, `erd_move_table`, `erd_move_tables`, `erd_sort_tables` |
| Columns | `erd_add_column`, `erd_remove_columns`, `erd_change_column_name`, `erd_change_column_data_type`, `erd_change_column_default`, `erd_change_column_comment`, `erd_set_column_primary_key`, `erd_set_column_unique`, `erd_set_column_not_null`, `erd_set_column_auto_increment`, `erd_move_column` |
| Relationships | `erd_add_relationship`, `erd_link_columns`, `erd_remove_relationship`, `erd_change_relationship_type`, `erd_change_relationship_on_delete`, `erd_change_relationship_on_update` |
| Indexes | `erd_add_index`, `erd_remove_index`, `erd_change_index_name`, `erd_set_index_unique`, `erd_add_index_column`, `erd_remove_index_column`, `erd_move_index_column`, `erd_set_index_column_order` |
| Memos | `erd_add_memo`, `erd_remove_memo`, `erd_change_memo_value`, `erd_change_memo_color`, `erd_move_memo`, `erd_resize_memo` |
| Settings | `erd_set_database`, `erd_set_database_name`, `erd_set_ddl_script` |
| Import | `erd_import_sql`, `erd_import_graphql`, `erd_import_dbml`, `erd_import_aml`, `erd_import_json` |
| Batch | `erd_batch` |

`erd_batch` runs several edit tools in order as one edit, all or none: the operations are tried on
a copy of the document first, so a refused one is named and nothing is applied, and one `erd_undo`
reverts the whole batch. An operation named with `as` lets a later one pass `$name` (or `$name.1`
for its second created id) where it takes an entity id, so a table and its columns take one call.

The five import tools replace the document's tables, relationships, indexes and memos by default:
the four schema imports keep its settings but the view, which goes to the start of the canvas, and
`erd_import_json` takes the settings of the document it loads. With `mode: "append"` they add the
import instead, as the editor's Import and Add does: its tables, relationships and indexes arrive
as new ones in a grid below everything already there (a JSON document's, with its memos, in the
placement it has), the document's settings and tables stay as they are, and one `erd_undo` takes
them away. A foreign key to a table the import does not declare is dropped.

`erd_change_relationship_on_delete` and `erd_change_relationship_on_update`, and the `onDelete` /
`onUpdate` of `erd_add_relationship` and `erd_link_columns`, set a foreign key's ON DELETE and ON
UPDATE actions. An ERD Editor extension or plugin released before referential actions ignores them
when it serves the document, so update it.

An agent sets the database and its name, the settings of the schema itself. What the diagram
shows, the code generation language, the name cases, the bracket type and the locks that keep them
in the file are yours to set in the editor; `erd_list` and `erd_read` read them as the file saves
them.

`erd_set_ddl_script` sets the SQL the document keeps before and after the tables of its Schema SQL,
such as `CREATE EXTENSION` ahead of them or `GRANT` past them, written as is for every database, up
to 10,000 characters a call; a call replaces the whole script, an empty string removes one, and
`erd_undo` reverts it. The `erd_read` `scripts` format gives both scripts alone, however large the
schema, its snapshot gives them too, and its `sql` format writes them in place. An ERD Editor
extension or plugin released before scripts neither shows nor keeps them when it serves the
document, so update it.

Every edit tool takes the document `path`. `erd_set_database`, `erd_set_database_name` and
`erd_resize_memo` make no undo entry in the editor, so `erd_undo` passes over them and the result
says so.

The edit tools, `erd_batch` and the read tools (`erd_list`, `erd_get`, `erd_read`) refuse an
argument they do not declare, or one of the wrong type, with a JSON-RPC invalid params error
(-32602) before touching the document, so a misspelled argument is never silently dropped. The
other session tools ignore arguments they do not know.

## Documentation

- [Introduction](https://docs.erd-editor.io/docs/mcp/introduction) — what an agent can and cannot
  do, how it works, requirements
- [Install](https://docs.erd-editor.io/docs/mcp/installation) — Claude Code, Codex and any other
  client, setting up VS Code, updating
- [Live and Headless](https://docs.erd-editor.io/docs/mcp/live-and-headless) — where an edit
  lands, saving, undo, a window that goes away, conflicts on disk
- [Tools](https://docs.erd-editor.io/docs/mcp/tools) — every tool with its arguments, paging a
  large schema, `erd_batch`, results and refusals

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE)
