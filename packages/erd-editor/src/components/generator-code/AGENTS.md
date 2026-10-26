<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-25 -->

# generator-code

## Purpose

`src/components/generator-code/` holds the Code Generator tab: the code it draws, its options panel, Save file, and its context menu with the language menu's three groups. Whether each editor's panel shows lives in `generatorCodeView.ts`. What each language writes lives in `src/utils/generator-code/`, and its rules in `src/utils/generator-code/AGENTS.md`. The panel borrows the Schema SQL panel's shell, whose rules are in `src/components/schema-sql/AGENTS.md`. The settings the panel changes, and their locks, are ruled in `src/engine/AGENTS.md`. The direction of the code and the panel under a right-to-left language is in `src/i18n/AGENTS.md`. Several rules here are owner decisions, each marked with its date.

## Making a Change

1. **Read the files on the other side.** A change to the borrowed shell (`SchemaSQLOptions.styles.ts`, `SchemaSQL.styles.ts`, `keepSpace`, `resolvePanel`, `togglePanel`) reaches the Schema SQL tab too, so read `src/components/schema-sql/AGENTS.md`. A change to what a language writes reads `src/utils/generator-code/AGENTS.md`.
2. **Update the spec holding the rule you change.** Testing Requirements maps each rule to its spec.
3. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run. `GeneratorCodeOptions.browser.test.tsx` runs in real Chromium in that task.
4. **Run the e2e suite for visible panel changes.** `e2e/specs/generator-code-options.spec.ts` drives the panel in the real element. `pnpm --filter @dineug/erd-editor e2e` builds the package and runs every Playwright spec, this one included.
5. **Recopy the GraphQL grammar when shiki changes it.** `shikiService.test.ts` fails once a shiki release changes the shipped grammar. Copy it into `src/services/shiki/graphqlGrammar.ts` again with `embeddedLangs` dropped (Rules, Highlighting).

## Key Files

| File | Description |
| --- | --- |
| `GeneratorCode.tsx` | The tab: the code snapshot, the panel or Show options, Save file and Copy; given a `tableId`, the one table's code Table Properties shows, with no panel (`full` on the menu) |
| `generatorCodeView.ts` | `generatorCodeViewOf`, whether the panel shows; `toggleGeneratorCodePanel` |
| `languageSettings.ts` | `LanguageToExtensionMap`, `codeFileExtension`, and the settings each language reads: `readsDatabase`, `readsNameCases`, `readsBracket` |
| `generator-code-options/GeneratorCodeOptions.tsx` | The options panel; `LEFT_TO_RIGHT_MARK` |
| `generator-code-context-menu/GeneratorCodeContextMenu.tsx` | The code's context menu |
| `generator-code-context-menu/menus/languageMenus.ts` | `menuGroups`, the three groups; `menus`, the same rows flat |
| `src/constants/language.ts` | `LanguageToLangMap`, the Shiki grammar each language is coloured with |
| `src/services/shiki/graphqlGrammar.ts` | `@shikijs/langs/graphql`'s grammar without its `embeddedLangs` |
| `src/utils/file/exportFile.ts` | `exportCode`, which names the saved file and hands it to the host |
| `src/components/primitives/context-menu/context-menu-separator/` | `ContextMenu.Separator`, the rule between the language groups |

## Rules

### The options panel

These are owner decisions of 2026-10-09, except where a rule names the owner's call on 2026-10-10.

- **The code sits beside a 300 px panel.** The tab draws the whole document's code, on the left in every language. The panel uses the Schema SQL panel's shell: `SchemaSQLOptions.styles.ts` and `SchemaSQL.styles.ts`, `keepSpace`, `resolvePanel` and `togglePanel`.
- **The panel holds only settings the document has.** It holds Language, Database, Table Name Case and Column Name Case. Then comes Bracket, for Doctrine, JPA and SeaORM alone (`readsBracket`, `languageSettings.ts`). Save file and Copy sit at its foot.
- **JPA reads Bracket because of reserved names.** JPA quotes a reserved table name only under a bracket type. It joined the Bracket row by the owner's call on 2026-10-10.
- **No language has an option of its own.** The panel added no document field, action or lock bit, and nothing for `mcp-server`. Each list dispatches the setting's own action, as the tab's context menu and the palette do.
- **Keep a setting the language ignores, dimmed.** It stays with the note Not used by {language} (`code.notUsedBy`), which its list's `aria-describedby` names.
  - The Database is ignored by DBML, AML and Mermaid (`readsDatabase`), since they write every data type as is, whatever the database.
  - Both name cases are ignored by SeaORM, DBML, AML and Mermaid (`readsNameCases`). SeaORM names tables and columns its own way, and the schema languages keep the names as written.
- **Set each name over its list** (`shell.column`). The Schema SQL panel sets them side by side. Here `Column Name Case` takes about 127 px in English, and a row beside a 132 px list leaves a name about 116 px (measured 2026-10-10).
- **The Language list is the menu's three groups.** An `<hr>` stands between each two groups (The language menu's three groups, below).
- **Under right-to-left, end each name in U+200E.** Under a right-to-left language each name ends in U+200E (`LEFT_TO_RIGHT_MARK`), so `C#` never reads `#C`. The mark goes after the name, since an isolate or a mark before it would keep a typed letter from finding it. `dir="ltr"` on an option is not used, since it aligns the picked value left.
- **Write the vendors as they are.** The Database list writes them as they are, as the Schema SQL panel does.
- **The panel shows no Settings lock** (the owner's call on 2026-10-10). No glyph, title or description marks a locked row.
  - In a writable editor its list still changes the setting on every screen while the file keeps the locked value, as the context menu and the palette do. In a readonly one it turns the reader's screen alone (`src/engine/AGENTS.md` § Screen-only settings).
  - The Settings tab alone shows the locks. `GeneratorCodeOptions.test.ts` holds a new document, every code setting locked, to a panel with no lock.
- What a locked setting saves, and how a change to it travels: `src/engine/AGENTS.md` § Locks.

### Whether the panel shows

- **Keep the panel's state in `generatorCodeViewOf(app)`.** It lives in `generatorCodeView.ts`, a `WeakMap` over the store, apart from the Schema SQL tab's, one per editor. It is never in the store, the file, a change event or storage.
- **The panel opens from 640 px of editor.** It opens unless the editor is under 640 px wide (`SCHEMA_SQL_PANEL_COLLAPSE_BELOW`). That is decided when the tab, or its menu, first reads a measured `editor.viewport.width`.
- **Then it keeps what it was set to.** The panel keeps it across tab switches. Folded, it waits behind a Show options button over the code. The width is read only while the panel is unset, so a decided panel never renders again for a resize.
- **Hand the focus across on fold and open.** Hide options hands the focus to Show options, and Show options hands it back to Hide options.
- **Table Properties' tab shows one table, no panel.** Table Properties' Code Generator tab is one table's code with no panel. Its menu offers neither Options panel nor Save file (`full`).

### The code is a snapshot

These are owner decisions of 2026-10-09.

- **Write the code on mount and setting changes.** `GeneratorCode.tsx` writes it as the tab mounts. It writes again only when a setting it is written from changes: `language`, `database`, `tableNameCase`, `columnNameCase`, `bracketType`.
- **Never rewrite the code on a document edit.** That keeps the text what the reader is looking at (`GeneratorCode.test.ts`).
- **`database` joined those keys with the panel.** It joined them with the panel and the menu's Database row, which set it, as `bracketType` joined them for Doctrine. Until then nothing on the tab set it, and the code not following it was intended.
- What `createGeneratorCode` writes for each language: `src/utils/generator-code/AGENTS.md`.

### Save file, the context menu and the palette

- **Save file names files as every export does.** `exportCode` (`src/utils/file/exportFile.ts`) names the file `<databaseName>-<time><extension>`, with `unnamed-` when there is no database name. It hands the file to the host's export path (`setExportFileCallback`).
- **The extension is the language's.** `LanguageToExtensionMap` (`languageSettings.ts`) gives it: Swift `.swift`, Zod `.ts`, JSON Schema `.json`, SQLAlchemy `.py`, GraphQL `.graphql`, Mermaid `.mmd`, and the rest. A language the editor does not know saves as `.txt`.
- **Java and JPA save one `.java` file.** They save all their classes in it as is, which works as a paste (an owner decision of 2026-10-09).
- **The code's context menu offers the panel's settings.** It offers Language, Database, Table Name Case, Column Name Case, Bracket (Doctrine, JPA and SeaORM), Options panel (checked while it shows) and Save file. A row with a submenu draws no icon but Language's, Database's and Bracket's, and Save file reads without an ellipsis, as it saves at once (the owner's request of 2026-10-15).
- **The palette follows the tab.** Its Database row shows on this tab too, and its Bracket row only for Doctrine, JPA and SeaORM. `Code Generator: Options panel` folds the panel or opens it.
- **Export has no Code Generator entry** (an owner decision of 2026-10-09).
- The palette itself: `src/components/quick-search/AGENTS.md`.

### The language menu's three groups

- **Group the languages, the ORMs and the schemas.** `menuGroups` (`generator-code-context-menu/menus/languageMenus.ts`) holds three groups, each ascending by name ignoring case:
  - the languages: C#, Go, Java, Kotlin, PHP, Rust, Scala, Swift, TypeScript;
  - the ORMs: Doctrine, Drizzle, JPA, SeaORM, Sequelize, SQLAlchemy, TypeORM;
  - the schemas, which hold the tables written in another schema language or library: AML, DBML, GraphQL, JSON Schema, Mermaid, Zod.
- **The separators were the owner's call on 2026-10-09.** The grouping was the default put to the owner with them.
- **Put a `ContextMenu.Separator` before each later group.** It stands before the first row of each group past the first (`separated`). A press on it runs nothing and leaves the menu open.
- **The separator is an empty, textless rule.** It lives in `src/components/primitives/context-menu/context-menu-separator/`: an empty `role="separator"` div with a 1 px `border-top` in the menu's own border color, which forced colors keep. It has `margin: 4px 0` and is as wide as a row's highlight. It has no text, and so no message key.
- **Make the separator a sibling of the rows.** Never make it their wrapper, since a row closes a sibling's submenu by its parent's `data-id`. Rows inside a wrapper would leave two submenus open (`ContextMenuItem.tsx`; `ContextMenu.test.ts` pins the flat case).
- **The palette and Settings lock row read `menus`.** That is the same rows flat, with no rule.

### Highlighting

- **Each language maps onto one Shiki grammar.** `LanguageToLangMap` (`constants/language.ts`) colours Swift with Shiki's `swift` grammar, Zod with `typescript` and JSON Schema with `json`, grammars `shikiService.ts` loads one by one.
- **Of those three, only `swift` added bytes.** `@shikijs/langs/php` already embedded `json`, so only `swift` added bytes to the shiki worker (shiki 4.4.3, measured 2026-10-10).
- **Colour GraphQL with the copy in `graphqlGrammar.ts`.** GraphQL is coloured by `src/services/shiki/graphqlGrammar.ts`, `@shikijs/langs/graphql`'s grammar without its `embeddedLangs`. Those are JavaScript, TypeScript, JSX and TSX, for a `${…}` of a GraphQL string inside a script, which no generated schema holds.
- **Keep embedded grammars out of the inline worker.** With them, and `swift`, the shiki worker that the editor's UMD build and `obsidian-plugin` inline grew to a data url past Chromium's 2 MiB limit. `base64InlineWorkers` (`tools/vite/inline-worker.ts`) guards that limit. Without JSX and TSX it stays under the limit (measured 2026-10-10).
- The shiki shared worker the code block highlights through: `src/services/AGENTS.md`.

## Testing Requirements

- **`GeneratorCode.test.ts`** holds the snapshot rule, the 640 px fold, the focus hand-over, Save file and Copy, and the one table Table Properties shows.
- **`GeneratorCode.readonly.browser.test.ts`** runs in real Chromium on a readonly element over a document with every lock off. Each list rewrites the code on that screen alone while `value`, `runtimeValue`, a peer and the `change` event keep the document's settings, and Copy and Save file take the code shown.
- **`generatorCodeView.test.ts`** holds the view's first value, one view per editor, its fold apart from the Schema SQL tab's, and `toggleGeneratorCodePanel`.
- **`languageSettings.test.ts`** holds the settings each language follows and `codeFileExtension`, `.txt` included.
- **`generator-code-options/GeneratorCodeOptions.test.ts`** holds the panel's settings, the dimmed settings and their note, the left-to-right mark, the panel with no lock, and its Save file and Copy.
- **`generator-code-options/GeneratorCodeOptions.browser.test.tsx`** runs in real Chromium. It holds the 300 px width, the rule beside the code right to left, the rules between the language groups inside the native list, the 640 px fold, and the focus and Space on a real keyboard.
- **`generator-code-context-menu/`** has a spec beside the menu and each of its three menu modules. `languageMenus.test.ts` holds the groups, their order and the `separated` marks.
- **`src/components/primitives/context-menu/ContextMenu.test.ts`** pins the flat case, the separator a sibling of the rows.
- **`src/services/shiki/shikiService.test.ts`** holds the colouring to the shipped grammar's, and fails once a shiki release changes that grammar (Making a Change, step 5).
- **`e2e/specs/generator-code-options.spec.ts`** drives the panel in the real element, outside `pnpm test`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
