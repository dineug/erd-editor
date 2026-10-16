# @dineug/erd-editor-mcp

> An MCP server that lets a coding agent edit [ERD Editor](https://github.com/dineug/erd-editor)
> diagrams, live in VS Code, Obsidian or a JetBrains IDE, or straight on disk

Ask Claude Code, Codex or any [Model Context Protocol](https://modelcontextprotocol.io) client to
change your schema, and watch the change land on the canvas.

![coding agents](https://github.com/dineug/erd-editor/blob/main/img/coding-agents.webp?raw=true)

- **One tool per edit** — add a table, rename a column, relate two tables, import a DDL dump, read
  the schema back as SQL
- **Live in your editor** — when
  [VS Code](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode),
  [Obsidian](https://community.obsidian.md/plugins/erd-editor) or a
  [JetBrains IDE](https://plugins.jetbrains.com/plugin/23594-erd-editor) holds the diagram, the
  agent joins as one more collaborator, and its undo reverts only its own edits
- **Headless on disk** — with no editor around, the same tools edit the file itself
- **Large schemas** — paged, searchable reads, and DDL of just the tables the agent needs
- **Self-contained** — one file with no runtime dependencies

## Install

The server needs Node.js 22.12 or later; `npx` downloads it the first time the agent starts it.
Keep ERD Editor and the server up to date together: when one speaks an older hub protocol than the
other, the server refuses to connect and says which one to update.

### Claude Code

Run in your project folder:

```sh
claude mcp add --transport stdio erd-editor -- npx -y @dineug/erd-editor-mcp
```

### Codex

Run once; the Codex CLI, app and IDE extension share the setting:

```sh
codex mcp add erd-editor -- npx -y @dineug/erd-editor-mcp
```

Or add it to `~/.codex/config.toml`, or to `.codex/config.toml` in a trusted project:

```toml
[mcp_servers.erd-editor]
command = "npx"
args = ["-y", "@dineug/erd-editor-mcp"]
```

### Any other MCP client

Run `npx -y @dineug/erd-editor-mcp` as a stdio server, started in your project folder: it resolves
relative document paths against its working directory.

## Live and headless

For each call, the server looks in `~/.erd-editor/ide/` for an editor that holds the document: one
that has it open, or whose workspace, vault or project contains it.

| What it finds | What an edit does |
| --- | --- |
| An editor that holds the document | **Live.** The change shows on the canvas at once. VS Code keeps it unsaved until you, Auto Save or `erd_save` save it; Obsidian and JetBrains IDEs save it as they save your own edits. |
| No editor | **Headless.** The change is written to the file. |
| An editor with its connection off, or an untrusted workspace or project | **Refused**, since the editor's next save would overwrite the change. Reads still come from disk. |
| An editor on another hub protocol | **Refused**, naming the side to update. |

The connection is on by default in each editor:

- **VS Code** — a hub per window, in trusted workspaces, off with `dineug.erd-editor.agentHub.enabled`.
  The extension starts once the folder holds an `.erd.json` file or you open a diagram.
- **Obsidian** — a hub per vault window, off with **Settings → ERD Editor → Coding agents**.
- **JetBrains IDEs** — one hub for every open project, off with
  **Settings | Tools | ERD Editor → Coding agents**.

Obsidian from Flathub and a JetBrains IDE installed as a Flatpak run no hub, so there the agent
edits the file on disk even while the diagram is open. Close it first in a JetBrains IDE, which
does not reload it and would overwrite the agent's change with your next edit; in Obsidian, an edit
you have not saved yet gives way to the agent's.

Windows paths, Flatpak sandboxes, reconnecting and conflicts on disk are in
[Live and Headless](https://docs.erd-editor.io/docs/mcp/live-and-headless).

## Documents

- `erd_open_document` with `create` makes a missing file, adding `.erd.json` to a name with no
  extension. In an Obsidian vault, name it `.erd`, which the file explorer lists.
- `erd_list` lists the tables by id, 100 to a page, and finds them by name or comment with
  `query`. `erd_get` reads entities by id or table name.
- `erd_read` answers the whole document as a `snapshot`, as `sql` for any of the eight databases,
  as `json` or as its `scripts`, or the DDL of just the tables or table groups it names.
- A read answers at most 40,000 characters, or one larger entity whole: `erd_read` says how to
  narrow a larger read, and `erd_get` lists the ids it had no room for.
- Have the agent edit through the tools rather than write the JSON file itself.

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

- `erd_batch` runs up to 100 edits in order as one, all or none, and one `erd_undo` reverts it. A
  step named with `as` passes the ids it creates to later steps as `$name`, so a table and its
  columns take one call.
- The import tools replace the diagram by default and add to it with `mode: "append"`.
- The agent sets the database, its name and the Schema SQL scripts; the view and code settings stay
  yours to set in the editor.
- The edit and read tools refuse an unknown or mistyped argument before the document changes.

Every tool with its arguments and results is in [Tools](https://docs.erd-editor.io/docs/mcp/tools).

## Documentation

- [Introduction](https://docs.erd-editor.io/docs/mcp/introduction) — what an agent can do and how it
  works
- [Install](https://docs.erd-editor.io/docs/mcp/installation) — each client and each editor
- [Live and Headless](https://docs.erd-editor.io/docs/mcp/live-and-headless) — where an edit lands,
  saving, undo, conflicts
- [Tools](https://docs.erd-editor.io/docs/mcp/tools) — every tool, paging a large schema, results
  and refusals

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE)
