# @dineug/erd-editor-mcp

> An MCP server that lets a coding agent edit [erd-editor](https://github.com/dineug/erd-editor)
> diagrams, live in VS Code or straight on disk

Claude Code, Codex and any other client of the [Model Context Protocol](https://modelcontextprotocol.io)
get one tool per editing operation on an `.erd.json` document: add a table, rename a column,
relate two tables, import a DDL dump, read the schema back as SQL. When the document is open in
the [ERD Editor VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode),
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

## Live and headless

For every edit the server looks for a VS Code window that holds the document, through the lock
files the extension keeps in `~/.erd-editor/ide/`:

| What it finds | What an edit does |
| --- | --- |
| A window whose workspace contains the document, or that has it open | **Live.** Opens the document in the ERD editor if needed, joins the editing session and applies the change there. Edits appear at once and stay unsaved until the agent calls `erd_save` (or you save). The agent's `erd_undo` reverts only its own edits. |
| No window | **Headless.** Loads the file, applies the change and replaces the file atomically. `erd_save` has nothing to do. |
| A window with its hub off | **Refused.** Reads still work, from disk. Writing the file under an open editor would be overwritten by its next save, so the server does not. |

The live hub runs in trusted workspaces and is on by default. Turn it off with the VS Code setting
`dineug.erd-editor.agentHub.enabled`; the window then still guards its documents from headless
writes. The extension activates in workspaces that contain `.erd`, `.erd.json`, `.vuerd` or
`.vuerd.json` files.

The server never falls back to the file on its own while a window holds a document: if the
connection drops it reconnects, and only when that window has exited does it edit the file and say
so in the result.

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
eight supported databases and the `json` format is the raw file. Editing the JSON file by hand is
not supported.

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
| Relationships | `erd_add_relationship`, `erd_link_columns`, `erd_remove_relationship`, `erd_change_relationship_type` |
| Indexes | `erd_add_index`, `erd_remove_index`, `erd_change_index_name`, `erd_set_index_unique`, `erd_add_index_column`, `erd_remove_index_column`, `erd_move_index_column`, `erd_set_index_column_order` |
| Memos | `erd_add_memo`, `erd_remove_memo`, `erd_change_memo_value`, `erd_change_memo_color`, `erd_move_memo`, `erd_resize_memo` |
| Settings | `erd_set_database`, `erd_set_database_name`, `erd_set_language`, `erd_set_table_name_case`, `erd_set_column_name_case`, `erd_set_bracket_type`, `erd_set_relationship_data_type_sync`, `erd_set_relationship_optimization`, `erd_set_column_order`, `erd_set_max_width_comment`, `erd_set_ignore_save_settings`, `erd_set_show` |
| Import | `erd_import_sql`, `erd_import_graphql`, `erd_import_dbml`, `erd_import_aml`, `erd_import_json` |
| Batch | `erd_batch` |

`erd_batch` runs several edit tools in order as one edit, all or none: the operations are tried on
a copy of the document first, so a refused one is named and nothing is applied, and one `erd_undo`
reverts the whole batch. An operation named with `as` lets a later one pass `$name` (or `$name.1`
for its second created id) where it takes an entity id, so a table and its columns take one call.

Every edit tool takes the document `path`. Settings other than `erd_set_show`, and
`erd_resize_memo`, make no undo entry in the editor, so `erd_undo` passes over them and the result
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
