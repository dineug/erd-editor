<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# i18n

## Purpose

`src/i18n/` holds the display language runtime: `createI18n` and its `t()`, the 25 languages in `LOCALES`, `resolveLocale`, and the dictionaries under `messages/`. This file also holds the rules of the code outside the directory that carries the language. That is the option on the element, `localeContext`, `localized`, the locale picker and `settingsPage.ts`. It also holds the direction of every root that owns a stage or reads left to right. The palette's Theme and Display Language entries are in `src/components/quick-search/AGENTS.md`, and the language an export draws in is in `src/services/AGENTS.md`. Files of this directory are named from `src/i18n/`; other paths start at the package root.

## Making a Change

1. **Read the files on the other side.** A change to the palette's Theme or Display Language entry, or to a translated row's name, reads `src/components/quick-search/AGENTS.md`. A change to the language an exported image draws in reads `src/services/AGENTS.md`.
2. **Add a key to English and every language.** Write it in its `messages/en/` file, then in each other `messages/<code>.ts`. Each `<code>.ts` `satisfies Messages`, so the test task's `tsc --noEmit` refuses a missing key, and `messages.test.ts` checks the rest of its shape (Dictionaries).
3. **Change a rule and its spec together.** Where a rule below names a spec, update that spec with it. The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run, and the `*.browser.test.*` specs run in real Chromium in that task.
4. **Report the Mac-only spec on another platform.** `messages/fit.browser.test.ts` runs on a Mac only (Testing Requirements), so a run elsewhere names it as left to a Mac (root step 7).
5. **Run the e2e for a visible change.** Run `pnpm --filter @dineug/erd-editor e2e` (root step 6). Its fixture keeps the element's toggles off, so a spec turns them on first (Testing Requirements).

## Key Files

| File | Description |
| --- | --- |
| `translate.ts` | `createI18n` and its `t()`, `isolate`, and the types `I18n`, `Messages`, `MessageKey`, `PlainMessageKey` and `LocaleMessages` |
| `locales.ts` | `LOCALES`, each language's code and its own name (`label`), in the picker's order; `LocaleOption`, a code or `system` |
| `resolveLocale.ts` | `resolveLocale`, which reads BCP 47 tags in order to one language, English for none |
| `source.ts` | `sourceI18n`, English, what `localeContext` reads where nothing provides a language |
| `menuLabel.ts` | `menuLabel`, a menu row's key in the reader's language or its literal name |
| `messages/en/` | The source dictionary: one file per part of the editor, spread into `en` by `messages/en/index.ts`; `messages/en/en.test.ts` holds that shape |
| `messages/<code>.ts` | One file per other language, exporting its code without the hyphen (`koKR`) |
| `messages/index.ts` | `messagesOf` and `MESSAGES`, every dictionary imported statically |
| `messages/messages.test.ts` | Holds each language to English key for key and shape for shape |
| `messages/fit.browser.test.ts` | Measures the fixed-width texts in every language, on a Mac only |
| `imports.test.ts` | Holds the peer, engine and worker graphs to the rules under Peer and worker graphs |
| `src/components/erd-editor/useErdEditorAttachElement.ts` | `localeState`, `resolveLocaleOption()`, `applyLocale`, `setLocale` and `setSystemLocale` |
| `src/components/localeContext.ts` | `localeContext` and `useI18n` |
| `src/components/localized/Localized.tsx` | `localized(key, params)`, a template read where it renders |
| `src/components/locale-picker/` | The locale picker |
| `src/components/settings/settingsPage.ts` | `requestSettingsPage` and `takeSettingsPage` |
| `src/hooks/useNavigatorLanguages.ts` | A copy of `navigator.languages`, taken on mount and on `languagechange` |
| `src/__test-utils__/i18n.ts` | `pseudoMessages(tag)`, `createTestI18n` and `provideI18n` |

## Rules

### The option on the element

- **Keep the option out of the document.** It lives on the element. The language enters no store, history, peer or file. Each host keeps the option where it keeps the theme. These are owner decisions (2026-10-06).
- **`useErdEditorAttachElement.ts` holds the option.** It is `localeState.option`: a code, `system`, or null until `setLocale` or a pick sets one.
- **`resolveLocaleOption()` gives the option in force.** It is the option set, else `system` while `enableLocalePicker` is on and `en` while it is off, an owner decision (2026-10-06). So an element no host configures keeps the English it always showed, whatever the browser's language.
- **Read the option through `resolveLocaleOption()`.** Never read `localeState.option` for it, which is null before a call. The picker's check and the palette's read it through `resolveLocaleOption()`.
- **`system` follows the named tag, else the browser.** It is `resolveLocale` over the tag `setSystemLocale` named, else over `navigator.languages`. `src/hooks/useNavigatorLanguages.ts` copies that array on mount and on `languagechange`, since Chromium's array is frozen and r-html's `observable` never tracks it.
- **The setters apply before they return.** `setLocale` and `setSystemLocale` apply at once, and `onBeforeMount` resolves again. So a language set, or a picker turned on, before `appendChild` is in the first frame. Toggling `enableLocalePicker` re-applies the language.
- **`setLocale` ignores a value that is no option.** Only a code from `LOCALES` or `system` changes the option.
- **`changeLocale` fires for a pick alone.** It carries `{ locale }`, the option picked. It fires for a pick from the picker or the palette, the option already in force included. It never fires for a setter.

### One I18n object

- **Change the one `I18n` object in place.** `ErdEditor.tsx` provides `localeContext` on the host beside `themeContext`. `applyLocale` assigns a new language into that shallow observable, never through `provider.set()`, which a component mounted after a switch would miss.
- **Freeze nothing in i18n.** The element assigns into the object.
- **Set `lang` and `dir` on `div.root` alone.** Nothing is set on the host element or the page.
- **Read `t` inside the render function.** A component takes `useI18n(ctx)` at setup and reads `i18n.value.t` inside its render function. A string read at setup keeps the language the component mounted in.
- **Hand a template on with `localized`.** Code outside a component that hands a template on, such as a toast, writes `localized(key, params)` (`src/components/localized/Localized.tsx`). It is read where it renders, so it follows a switch too.
- **Hand functions needing text the live `I18n`.** A function that needs a string now takes `i18n: I18n = sourceI18n` as its last parameter. Its caller passes the live one.
- **Without a provider, `localeContext` reads English.** It reads `sourceI18n`, as in a spec that mounts a component alone.

### Naming the display language

- **Name the display language `locale` everywhere.** So it is `LocaleOption`, `setLocale`, `changeLocale` and `enableLocalePicker`. The exceptions are `settings.language`, the `Language` enum and `LockSettingType.language`, which are the code generator's.
- **Name no prop `lang` or `dir`.** `HTMLElement` already has both.

### Dictionaries

- **`messages/en/` is the source.** It has one file per part of the editor. Each key is flat and prefixed with its file's name (`common.close`, `findReplace.matchCount`). The files spread into one `as const` `en`, a shape `messages/en/en.test.ts` holds. `common` holds the words several parts share.
- **Write every other language as `<code>.ts`.** It exports its code without the hyphen (`koKR`) and `satisfies Messages`. `messages.test.ts` holds each to English, key for key and shape for shape:
  - the same placeholders;
  - a plural's forms exactly its language's `Intl.PluralRules` categories, with `{count}` in each;
  - `ERD Editor`, `ERD`, `SQL`, `PNG`, `SVG` and `JSON` kept wherever English writes them;
  - no bidi control, and no empty or padded text;
  - a `common.placeholder.*` of 12 code points at most.
- **Fit fixed-width text in every language.** Text the editor gives a fixed width fits that width in every language. `messages/fit.browser.test.ts` measures all three cases below (Testing Requirements).
  - A `common.placeholder.*` measures no wider than an empty column (`COLUMN_MIN_WIDTH`), measured as `src/utils/text.ts` measures a value. So a shorter standard word or a standard abbreviation stands in for a long one (`по умолч.`, `obs.`). Where a language has neither, the SQL keyword stands in (Hebrew's `DEFAULT`).
  - `toolbar.databaseName` fits the toolbar's input (`TOOLBAR_DATABASE_NAME_WIDTH`).
  - The three labels of each Schema SQL options segment group fit 207 px of the 300 px panel (`SCHEMA_SQL_PANEL_WIDTH`). The groups are Statements (the literals `Create`, `If not exists` and `Drop & re-create`) and Header (`common.none` beside the literals `USE` and `CREATE + USE`).
- **Import every dictionary statically.** `messages/index.ts` imports each one statically, never with `import()`. Obsidian loads one `main.js`, the UMD build is one file, and `pnpm size` counts a dynamic chunk too.
- **Only the element and specs import `messagesOf`.** Peer and worker graphs, below, keeps `messages/index.ts` out of the peer, engine and SharedWorker graphs.

### Keys and parameters

- **Interpolate `{name}` alone.** A message uses no ICU syntax. A number is written as `String(n)`.
- **Make a plural only where English shows numbers.** A plural is an object of forms that `t()` picks among by the language's `Intl.PluralRules`, `other` where a form is missing. `findReplace.matchCount` and `colorPicker.degrees` are among them.
- **Otherwise pick between two plain keys in code.** A choice English makes without a number is two plain keys picked in code (`contextMenu.deleteColumn` / `deleteColumns`). A plural category does not fit there, since a category such as Russian's `one` also covers 21.
- **Write a sentence as one message.** Its parts enter as placeholders, never as fragments joined in code. A word no language translates enters as a placeholder too (`{format}`, `{database}`).
- **Type label keys as `PlainMessageKey`.** Every label map and every `labelKey`, `titleKey` or `nameKey` is typed so: `menuLabel`, `LnbLabelKey`, `SCOPE_LABEL`, `ColumnTypeToMessageKey`. `t()` handed the whole `MessageKey` union asks for a parameters argument.
- **Keep `ColumnTypeToMessageKey` in `columnTypeLabels.ts`.** `src/components/settings/columnTypeLabels.ts` keeps it out of `src/constants/schema.ts`, a module the peer graph reaches.
- **`t()` isolates each value under right-to-left.** Under a right-to-left language it wraps each value in U+2068 and U+2069, so a name or a number keeps its own direction. English output stays byte for byte what it was.
- **Write the isolates as escapes.** The source code writes the two as `\u2068` / `\u2069` escapes, never as characters.
- **Isolate each name in a joined list.** A list of names joined in code uses `isolate`, as the Schema SQL drop warning does. Then the list's conjunction, not a Latin name, sets the direction the list runs in.

### What stays as written

- **Write what stays as written as a literal.** It is a literal in code, never a key:
  - database vendors, code languages, file formats, SQL keywords and referential actions;
  - the Schema SQL statements and headers (`Create`, `If not exists`, `Drop & re-create`, `USE`, `CREATE + USE`), an owner decision (2026-10-07);
  - data types, `PK`, `FK`, `UQ`, `AI`, `N-N`, `NULL`, `AK<n>.<m>`, `UNIQUE` and `D:C U:R`;
  - the name cases and quote styles, key names, Hex, R, G and B, `{n}x`, `px` and `%`;
  - the Radix color keys the theme builder names its swatches by;
  - generated output, exported file names and developer errors.
- **Each language names itself in the picker.** Its name is `LOCALES`' `label`. Its English name is only a hidden search term of the palette.
- **The tab is Code Generator wherever named.** Its key is `common.tab.codeGenerator`, which the palette's row uses too.

### The canvas stays left to right

- **Give each stage root `dir="ltr"`.** Each root that owns an on-screen stage carries it, since konva's `Text` reads the direction through its canvas. The roots are `Canvas.tsx`, `Minimap.tsx` and `VisualizationGraph.tsx`. The Flow view, the diff viewer, time travel and the placement preview reuse `Canvas.tsx`.
- **The export stage resolves to `ltr`.** It is detached, so it takes no direction from a root.
- **Give left-to-right parts `dir="ltr"` too.** The parts that read left to right in any language carry it on their roots:
  - the floating and Visualization toolbars, the content compass and the scrollbars;
  - the column data type cell and Map Columns' data types;
  - the code block;
  - the Schema SQL and Code Generator tabs' rows of code and options panel (`SchemaSQL.tsx`, `GeneratorCode.tsx`), each panel taking the reader's direction back on its own root;
  - the Schema SQL panel's script editors (`ScriptEditor.tsx`);
  - the color picker, the diff viewer, time travel and its slider, and the automatic placement preview;
  - `Kbd`, `Slider`, `Switch` and the welcome screen's arrows;
  - a menu row's name kept as written (`Menu`'s `literal`): the vendors, the code languages and the referential actions, so `C#` never reads `#C`.
- **`Kbd` is `width: fit-content`.** So in a right-to-left cell it starts where the cell does.
- **Set direction as a root attribute.** Never write it as a stylesheet rule. A global `.konvajs-content` rule would move the global bucket the `src/styles/emittedCss.*.test.ts` specs pin.
- **Write other CSS as logical properties.** Other physical CSS became logical (`margin-inline-*`, `inset-inline-*`, `border-inline-*`). Four parts keep a physical side in every language:
  - The draw-target layer places its outline, strip and buttons by `left` in the canvas's coordinates. So the buttons stand on a table's left in every language, which `DrawTargetButtons.browser.test.tsx` checks in Arabic.
  - The table group draw's box (`TableGroupDraft.tsx`) is placed by `left` and a translate in the erd root's pixels. `useTableGroupDraw` measures from the root's left edge, so the box spans from the press in every language. `tableGroupCommands.browser.test.tsx` checks it right to left.
  - The Explorer stands left of the canvas in a `dir="ltr"` row and keeps its border and its edge on the physical right (`border-right`, `right`), while its root and the canvas's scope take the reader's direction (`e2e/specs/explorer.spec.ts` checks it in Arabic).
  - The options panels keep `border-left`, and the Code Generator panel's is the Schema SQL panel's `shell.panel`. The rule stays beside the code in every language, since the row is `ltr` while the panel follows the reader. `SchemaSQLOptions.browser.test.tsx` checks it in Arabic.
- **Open a context menu at the pointer.** It does so in every language.
- **Open a submenu leftward under right-to-left.** Under a right-to-left language a submenu opens to the left of its row. `ContextMenuItem` passes `openLeft`, which `fitMenu` flips only when the left edge cuts it more. The chevron (`SubmenuChevron`) turns to match.
- **The toolbar's undo and redo swap glyphs.** So undo points back the way a right-to-left reader goes.
- **Give text that may run either way `dir="auto"`.** That covers:
  - the palette's names and keywords, the Explorer search's excerpt rows, Table Properties' chips, Map Columns' column names, the Schema SQL panel's table group choices, the locale picker's System hint;
  - the toolbar's database name and the Settings lock values;
  - the palette's input and the Explorer search's two inputs while they hold text (`TextInput`'s `dir`). An empty one follows the page, since Chromium sets an empty auto field left to right.
- **Align rows to the panel's side.** A palette row's keywords align `left`, or `right` under `[dir='rtl']`, since Chromium ignores `match-parent`. So text in the other direction still sits by its icon or its rule.

### The export worker's language

- What the export worker draws in (the `LocaleMessages` it is handed, English for a request without one): `src/services/AGENTS.md`. The snapshot `ExportImage` takes as it opens: `src/components/export-image/AGENTS.md`.

### Peer and worker graphs

- **Keep i18n out of the DOM-free entries.** `imports.test.ts` keeps every `i18n/` module, `src/components/localeContext.ts` and `src/components/localized/` out of what `src/peer/index.ts` and `src/engine/index.ts` reach.
- **Let a SharedWorker reach the English runtime alone.** The three SharedWorkers reach only `translate`, `locales`, `source`, `menuLabel` and `messages/en/**` of `i18n/`. They never reach `messages/index.ts` or another language, since the export worker is handed its dictionary. `imports.test.ts` holds this too.
- **Import i18n types with `import type`.** A module either graph reaches imports an i18n type with `import type { … }`, as `src/utils/emitter.ts` imports `LocaleOption`. The walker the graph specs share (`src/__test-utils__/importGraph.ts`) counts `import { type … }` as a value import.

### The palette's Theme and Display Language

- The palette's Theme and Display Language entries, a translated row's English `Action.alias`, and the rebuild on a language change: `src/components/quick-search/AGENTS.md`.

### The locale picker

- **`ErdEditor` mounts the picker while `enableLocalePicker` is on.** It lives in `src/components/locale-picker/`. The toolbar's language button (`.toolbar-locale`) toggles it through `openLocalePickerAction`.
- **List System first, then the 25 languages.** System shows the language it stands for now beside it. Each language label carries its own `lang`.
- **Pin System and the rule under it at the top.** They stay at the list's top with `position: sticky`. The list's `scroll-padding-block-start` keeps a row clear of them.
- **Open focused on the checked row.** The picker opens scrolled to that row. The arrows go round, Home and End jump, and Enter or Space picks.
- **Stop every bound chord but `PANEL_PASSING_BINDINGS`.** They stop at the picker, as in the Explorer.
- **A pick emits `setLocaleOptionAction`.** It closes the picker and hands the keyboard back with `focusEvent`.
- **The picker and other panels close each other.** Opening the picker closes the theme builder and Table Properties and leaves the Explorer open. Opening the theme builder, Find and Replace or the palette closes the picker. `stop` closes it, and so does its close button, a press outside it and the toolbar (`handlePress`).
- **Its close button is the editor's `x` tool** beside the title, named `common.close` with the stop key in its title. It closes as `stop` does and hands the keyboard back with `focusEvent`.

### The Settings page from outside the tab

- **Open a Settings page through `requestSettingsPage`.** `src/components/settings/settingsPage.ts` opens a Settings page from outside the tab, as the welcome screen's Shortcuts row does. `requestSettingsPage(store, page)` records the page for that store and switches to the Settings tab.
- **The tab takes the page once.** It takes it as it mounts (`takeSettingsPage`). Reached any other way, the tab opens on Preferences.

## Testing Requirements

- **Specs read English.** happy-dom and Playwright Test run in `en-US`. `vitest.config.ts` pins the browser provider to `contextOptions: { locale: 'en-US' }`, since an element following System shows the browser's language.
- **Turn the toggles on in an e2e spec.** The e2e fixture keeps `enableThemeBuilder`, `enableLocalePicker` and `enableWelcomeScreen` off (`ElementToggles`); a spec turns them on with `ErdEditorPage.enable(…)` and gives System its language with `test.use({ locale })`. The fixture is `e2e/fixture/main.ts`, the page object `e2e/support/ErdEditorPage.ts`.
- **Tell a translated string from a literal.** `src/__test-utils__/i18n.ts`'s `pseudoMessages(tag)` (`xx:Close`), `createTestI18n` and `provideI18n` tell a string read through `t()` from a literal left behind.
- **Switch the language under a mounted component.** That catches a string read at setup instead of in the render.
- **`messages/fit.browser.test.ts` runs on a Mac only.** It measures the three fixed-width cases of Dictionaries, every `common.placeholder.*` key picked by prefix, in the font a Mac resolves the stack to. It is gated with `it.runIf` on `server.platform`, the Vitest server's `process.platform`.
  - The bounds were fitted to that font, and other platforms resolve the stack to fonts wider in places.
  - The Playwright Linux image cut ko-KR's `데이터 타입`, and DejaVu Sans cut eight placeholders and pt-PT's database name (measured 2026-10-06, when the bounds were set).
  - So elsewhere `messages.test.ts`'s 12-code-point cap is the check.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
