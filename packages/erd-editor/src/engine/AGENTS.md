<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# engine

## Purpose

`src/engine/` is the editor's store: the action modules under `modules/` with their reducers and undo entries, the action type lists in `actions.ts`, the rx operators and the stores. Reducers merge through the LWW operators of `@dineug/erd-editor-schema`, so peers that hear the same actions in another order hold the same document. A change here keeps three things in step: the action type lists, the file form a host compares for `changed`, and the `actions$` barrels `mcp-server` builds its tools from. The same features have rules in `src/utils/AGENTS.md` (imports, appends, duplicates), `src/services/AGENTS.md` (automatic placement) and `src/peer/AGENTS.md` (the `peer.js` entry and its graph). Others are in `src/components/erd/AGENTS.md` (table groups in the scene), `src/components/schema-sql/AGENTS.md` (the Schema SQL tab) and `src/utils/schema-sql/AGENTS.md` (the constraint names the SQL writers build).

## Making a Change

1. Read the nested file of each other directory the change reaches, listed in Purpose. A change to a change type, an `actions$` barrel or the key set of `peer.js` crosses into `mcp-server`, so read `packages/mcp-server/AGENTS.md` too (root step 1).
2. Carry what each rule below says moves with it: the lists a new action type joins (Actions and lists), the spec the rule names, and `mcp-server`'s `tools/copy.ts` for the foreign key rules.
3. Run `erd-editor`'s `test` task (root step 3). A change to a change type, an `actions$` barrel or the key set of `peer.js` changes an entry's exports, so it runs `pnpm test` instead (package step 3). That run holds the `test` tasks of `mcp-server`, `app`, `vuerd-vscode` and `obsidian-plugin`, which Rules names.
4. For a change to the view seams, run `pnpm --filter @dineug/erd-editor e2e` (root step 6), since `e2e/specs/visualization-flow.spec.ts` asserts what the host hears.

## Key Files

| File | Description |
| --- | --- |
| `actions.ts` | The hand-kept action type lists: `ChangeActionTypes`, `HistoryActionTypes`, `ReadonlyIgnoreActionTypes` (`ChangeActionTypes` less what `hasReadonlyIgnore` names), `ViewIgnoreActionTypes`, `LockSettingActionTypes`, `ReplicaChangeActionTypes`, `ReplicaActionTypes`, `SharedActionTypes`, `SharedStreamActionTypes`, `SharedFollowingActionTypes`, the `StreamRegroup*ActionTypes` and `StreamActionTypes` |
| `rx-store.ts` | `createRxStore`: the view seams, `lockIgnoreFilter` on `change$`, the `@@move` regroup, `undo` / `redo`, the internal `RxStoreOptions` |
| `shared-store.ts` | `createSharedStore`, its `FLUSH_TICKS` and `SharedStoreInternalOptions` |
| `stream-flush.ts` | Flushes history first, then the outbound pipe |
| `settle.ts` | `settleDocument`, what both load reducers derive before they return |
| `replication-store.ts` | `createReplicationStore`, the replica whose `change` carries `changed` |
| `peer-store.ts` | `createPeerStore`, the store `peer.js` exports, with its labelled undo units |
| `rx-operators/` | The batch operators (`readonlyIgnoreFilter`, `lockIgnoreFilter`, `viewActionRedirect`, `viewIgnoreFilter`, `groupByStreamActions`, `flushOnNotifier`); `index.ts` is the barrel `index.test.ts` pins |
| `modules/<module>/` | Nine modules (`editor`, `settings`, `table`, `table-column`, `index`, `index-column`, `relationship`, `memo`, `table-group`), each with `actions.ts`, `atom.actions.ts`, `generator.actions.ts`, `history.ts` |
| `modules/editor/generator.actions.ts` | `toSchemaImportJson`, `withImportSettings`, `withGridPoints`, `toSchemaAppend`, `loadSchemaAction$` |
| `modules/settings/atom.actions.ts` | `landLoadedSettings`, `CodeLockSettings` |
| `modules/relationship/fkColumns.ts` | `toForeignKeyNames`, pinned by `fkColumns.test.ts` |
| `modules/relationship/endFlags.ts`, `modules/table-column/keys.ts` | The relationship fields and the foreign key bits, read whole off the document |
| `modules/relationship/referenceType.ts` | `toReferenceDataType` |
| `modules/table-group/` | The table group model |

## Rules

### Actions and lists

- **Add an action in four places.** Write it in the module's `actions.ts`, `atom.actions.ts` and `history.ts`, whose undo entry puts it in `HistoryActionTypes`. Then add it to the hand-kept lists in `src/engine/actions.ts`. A type missing from `ChangeActionTypes` compiles, then silently breaks the host `change` (autosave), collaboration and readonly.
- **The action lists enforce readonly.** Readonly is enforced by those lists: while the editor is readonly, `readonlyIgnoreFilter` (`engine/rx-operators/`) drops its own `ReadonlyIgnoreActionTypes` actions (every `ChangeActionTypes` type but the viewport and setting changes `hasReadonlyIgnore` names; a peer's `Tag.shared` actions pass), so a component that hides a control from a reader is not what refuses the edit. A path that does more than dispatch reads `store.getReadonly()` itself before it starts, since the filter drops only its document actions: `undo` / `redo` in `engine/rx-store.ts`, whose replay passes the filter, and the placed imports and appends (`src/utils/AGENTS.md`).
- **The `actions$` barrels are `mcp-server`'s catalog.** A new change type also needs a tool or an exclusion reason in `mcp-server`'s reachability spec (`src/tools/reachability.test.ts`). Every generator a module's `actions$` barrel exports is part of the catalog `mcp-server` builds its tools from: its `tools/registry.kind.test.ts` holds a census of every key and a reason for each editor generator, so a helper that the barrel's generators call (`loadSchemaAction$`, `toSchemaImportJson`, `withGridPoints`) is exported by name and stays out of the barrel.
- **Reducers write through the LWW operators.** Use the operators from `@dineug/erd-editor-schema` with `action.version`. A direct write wins every merge and corrupts collaborative sessions.
- **Reader-only state stays out of every list.** `editor.views`, `visualizationMode`, `handTool`, `zenMode`, `openMap` and `lastCanvasType` are in no list. So they are never saved, undone or sent to a peer. `engine/actions.test.ts` pins the ten `editor.view*` types and `editor.changeVisualizationMode` out of all of them.

### Settings that travel as changes

- **The Schema SQL scripts are document content** (`settings.ddlScripts`, owner decisions of 2026-10-07). There is one `before` and one `after` string for the whole document. Each is written as is into the DDL of every database.
  - `settings.changeDDLScript` writes each script through a register of its own (`replaceOperator`, `settings.ddlScripts` with the position as the path). So a peer's edit of one script never overwrites the other.
  - The action ignores a position or a value no editor sends. It makes an undo entry (`settings/history.ts`) and is dropped under readonly like every change. `mcp-server`'s `erd_set_ddl_script` sends it too.
  - How the DDL is generated (create, `IF NOT EXISTS`, or drop and re-create) and its header are the window's own choices, no setting: `src/components/schema-sql/AGENTS.md`.
  - An editor built before the scripts ignores the action, and saving a document there drops them.
- **A scroll or zoom is still a change**, unlike one in a Flow view (View seams, below).
  - Scroll and zoom (`settings.scrollTo`, `streamScrollTo`, `changeZoomLevel`, `streamZoomLevel`) stay in `ChangeActionTypes`, which following and shared views need.
  - The replica reports each as a `change`. Every hub (`agent-hub-host`'s `joinWindow.ts`, its Kotlin port) waits for one replica save per change before `join` or `save` answers. A missing save holds them to their caps and has `save` answer `saved: false`.
  - A zoom moves the origin too, keeping the point it zooms around in place (`changeZoomLevelAction$`, `streamZoomLevelAction$`, `pinchZoomAction$`).

### Locks

- **The locks cover the view and code settings** (owner decisions of 2026-10-06). `settings.lockSettings` (`LockSettingType`) locks the viewport, the tab, the language, both name cases and the bracket type. The viewport lock takes the origin and the zoom as one, since one saved without the other opens elsewhere. Every lock is on in a new document.
- **A locked setting saves its locked value.** `toDocumentJson`, the file form every `value` getter returns, writes a locked setting at `settings.lockedValues`, as `toJson` does. So a change to it comes out `changed` false, and the hosts write nothing and mark nothing modified. Those hosts are `vscode-extension`'s `erd-editor.ts`, `obsidian-plugin`'s `ErdView.ts` and `intellij-plugin`'s `ErdEditor.kt`.
  - `app`'s Drive save leaves a view no lock holds out of its fingerprint.
  - The element's `change` event leaves such a change out. `lockIgnoreFilter` on `rx-store.ts`'s `change$` filters it by `LockSettingActionTypes`, reading the lock as the batch passes. The replica still reports it for the hubs.
- **Locking and unlocking carry values.**
  - `changeLockSettingsAction$` locks at what the store holds and carries the values, so every peer and the replica hold one lock.
  - An unlock carries what the store shows of the code settings it names. Those are `CodeLockSettings`: the language, both name cases and the bracket type, whose setters every peer applies. Every peer and replica then show those values, so all save one value.
  - A reader that opened the file while the lock was on still shows the value it held (`replication-store.test.ts`, an unlock after a reader joined from the file).
  - An unlock of the viewport or the tab carries nothing, since each reader's screen is its own.
  - Taken on the Settings tab, a tab lock locks `editor.lastCanvasType`: the last tab other than Settings the reader stood on. `changeCanvasType` and both load reducers record it before and after they move the tab.
  - Locking a setting is a change of its own, readonly-ignored like the rest.
- **Each lock bit is a register.** The reducer writes each bit through `replaceOperator` (`settings.lockSettings`, the bit as the path). So the latest lock or unlock of a setting wins on every peer.
  - The reducer refuses a lock whose values the setting's own setter would refuse, the Settings tab included.
  - An unlock sets what it carries whether it wins the bit or not, skipping a value the setter would refuse.
  - The four code setters and an unlock's values write through one register per setting, outside the bit's (`replaceCodeSetting`, `settings.code`, the field as the path). So a setter and an unlock that cross land one value on every peer.
  - An unlock and a newer relock that cross show one value on every screen while the relock holds the file (`replication-store.test.ts`, an unlock crossing a newer relock). A version tie is the exception, as everywhere.
- **The replaced switch stays for older agents.** `settings.changeIgnoreSaveSettings`, the switch the locks replaced, has a reducer that changes nothing. It is in the replica's lists alone (`ReplicaChangeActionTypes`, which `ReplicaActionTypes` takes in), not `ChangeActionTypes`. So the replica reports a batch an agent written before the locks sends (`changed` false), and the hub waiting on it confirms the save. The element fires no `change`, and no peer is sent it.
- **The Lock rows show each lock's value.** The Settings tab's Lock rows (`components/settings/lockSettingRows.ts`) show the value each lock holds, or the live value dimmed while the lock is off. Each value reads by the name the menu that sets it gives. The viewport shows as its zoom and its origin, the origin shortened with the unit the content compass prints (`formatDistance`: `12k`, `-2.4k`).

### Loads and new documents

- **A new document starts with every lock on**, so looking around a new diagram never changes its file. The store's initial state is `erd-editor-schema`'s `createSchema()` (`lockSettings` 63).
  - That document is what an element given no value shows. A replica's or a peer's `value` shows it before a load (`app`'s new Drive file, `mcp-server`'s `createEmptyDocument`), and so does every empty value a load takes.
  - `utils/loadValue.ts`'s `toLoadValue` turns an empty text into that document's JSON for `setInitialValue`, the `value` setter, `setDiffValue`, the replica and the peer. So the replicated `editor.loadJson` carries text that any peer, a released one included, parses to the same document.
- **A file keeps the locks it names.** One that names none (an older v3 file, a v2 `.vuerd`) opens with all of them on. Its origin, zoom and tab are where a new document's are (`erd-editor-schema`'s `resetPreLockView`). A load from a release before the locks names none, so it turns every lock on, as opening a file it wrote would.
- **An import keeps the settings it replaces.** A SQL, DBML, AML or GraphQL import keeps every setting of the document it replaces but the view, the locks included. The locked view is set where the parser left the view (`withImportSettings`, under `toSchemaImportJson`, which `loadSchema*Action$` and a placed import share).
  - A source given to an element with no value, as `app`'s `convertSource` does, so becomes a new document too.
  - A source imported into a file keeps that file's locks (`useErdEditorAttachElement.test.ts`).
  - Placed imports and Import and Add appends: `src/utils/AGENTS.md`.
- **`clear()` keeps every setting**, so a cleared file keeps its locks.
- **Unreadable text empties the document.** Text the parser cannot read, such as a file with merge-conflict markers, empties the document and changes no setting (r-html logs the reducer's throw). So a store that loaded nothing before shows a new document (`replication-store.test.ts`).
- **Time Travel's preview opens on the reader's view.** It opens on the reader's scroll and zoom whatever the lock says (`toPreviewJson`), since it is the reader's own screen.
- **A replacing load keeps each locked screen.** Every load that replaces the open document goes through `landLoadedSettings` (for imports, an owner decision of 2026-10-06). Such a load is `editor.loadJson`: an import, the undo of a load or a clear, a peer's load, the `value` setter.
  - On each store, it keeps the screen of each locked setting where it was, the viewport excepted.
  - It takes each lock through its register. It takes a bit no lock owns from the load, as it takes `show`.
  - The view lands where the load puts it and is pulled as any load's is.
  - A load that opens a document (`editor.initialLoadJson`) takes everything the file holds.

### Values and `changed`

- **Two values, two readers** (owner decisions of 2026-10-10): every `value` getter (the element's, `ReplicationStore`'s, `PeerStore`'s) returns the file form, `toDocumentJson`, and every `runtimeValue` getter `toJson`, the document as the store holds it, removed entities included, which a collaborator's or a second view's `setInitialValue` takes, since an undo of a removal another peer sends restores the entity whole only where its tombstone is held. Inside the editor what reloads the document reads `toJson` (the undo of a load in `editor/history.ts`, Time Travel, the diff viewer, automatic placement, the image export), and only what leaves as a file writes `toDocumentJson` (the JSON export of the menu and the palette).
- **No collector removes tombstones.** Nothing collects a removed entity: the schema GC, its SharedWorker and the per-entity `meta` it timed itself by are gone, since replicas that loaded at different times collected different tombstones and diverged; the runtime value keeps every tombstone until the document is next opened from its file, whose form leaves them out.
- **`changed` compares values, never the file.** The replica keeps the value its last `change` handed out, the file form `toDocumentJson` writes. After a load it takes the value the first change action finds.
  - That form leaves out removed entities, `zIndex`, the widths, the anchors, the key marks and the relationship flags. So these come out `changed` false: a table added and removed within one change, an edit landing on a removed table, and a load that restacks alone.
  - A file an older release wrote, a v2 `.vuerd`, a byte order mark or a hand edit all differ from that value from the load on. So a host that compared bytes with its file would take the first scroll for an edit.
  - A load that lands while a change is pending reports that change with `changed` false.
  - The cases `replication-store.test.ts` pins are under Testing Requirements.
- **Both load reducers end in `settleDocument`** (`engine/settle.ts`). It runs before the view is pulled and writes what the document derives, listed below. So the element, a replica, a peer and a scratch store all hold those values when the reducer returns. No hook wakes on a load, and a pan replayed right behind it is no edit.
  - The primary key mark of every column, from its options, and the foreign key marks.
  - Every `ui.width*`, measured again with this machine's fonts.
  - The relationship anchors.
  - Every connector's route, in a store that draws. A peer and a replica draw nothing, so their `EngineContext` says `routes: false` and their load routes none. Routing a document of hundreds of relationships was most of its cost, and only a drawing reads a route.
  - Each relationship's `identification` and `startRelationshipType`. One removed, or one whose end columns are all gone, gets a new relationship's values.
- **A value a load derives joins `settleDocument`.** Put it there, never in a hook on an action a load dispatches, that load's `editor.clear` or `editor.initialClear` included.
  - `store-hooks.test.ts` holds this by recording what both load generators and a replica's `setInitialValue` reduce. `engine/settle.test.ts` holds that nothing rewrites the value after it.
  - Keep such a value out of the file form, since a file another machine wrote would differ by it. `app`'s `toFingerprint` and `toDriveFingerprint` read that form whole (`app`'s `utils/documentFingerprint.ts`; `packages/app/AGENTS.md`).

### Derived key values

- **Derived key values read the whole document.** The foreign key bits and each relationship's `identification` and `startRelationshipType` are read whole off the document. So peers that took the same actions in another order hold the same values.
  - The readers are `validateForeignKeys` in `table-column/keys.ts`, and `recalculateIdentification` and `recalculateStartRelationshipType` in `relationship/endFlags.ts`.
  - Those modules import no action module. So `settleDocument` calls them from the load reducers without an import cycle, and the hooks share them.
  - Bits set and cleared one relationship at a time cleared a column another relationship still ended on. A link that woke no hook left the fields at their defaults on one peer and derived on another.
- **A column's bit follows the document.** It is on exactly while its table is in the document, the table lists it, and a relationship in the document ends on it there. So a removed column, or one of a removed table, has it off, whatever order its peers heard the removal and the link in. The runtime value holds such a column, and the file form leaves it out.
- **A relationship reads only live end columns.** It reads only the end columns its end table holds while that table is in the document. With none left it is not identifying and dashed, as a new one starts.
  - A removed relationship reads none. So the tombstone the runtime value holds carries those values on every peer, whatever it was remapped or keyed onto before the removal arrived.
- **The bits are read once per batch**, in the microtask after it. They use no timer, since a host reads a value one scheduler turn after a batch, as `mcp-server`'s headless session does before it writes its file. They are read on these:
  - a relationship added, removed or remapped (`relationship.changeColumns`);
  - a column or table added or removed, an undo's included;
  - a load's reducer, before it returns.
- **The relationship fields follow the same reads.** The two fields are read the same way, on those actions and on the primary key flag. The start is also read on the not null flag, which a key turned on sets with no action of its own, in the microtask after its batch.
  - So the start is read one microtask after the identification. Otherwise a batch keying two end columns at once left it ringed (`peer-store.node.test.ts`).

### View seams

- **While a view is active, two seams act** (`rx-store.ts`). Each applies while `getActiveView` finds a view.
  - `viewActionRedirect` rewrites `settings.scrollTo` / `streamScrollTo` / `changeZoomLevel` / `streamZoomLevel` into their `editor.view*` twin. It leaves a `Tag.shared` or `Tag.following` action as it is, since a peer's placement and a follow of one belong to the document however the reader stands.
  - `viewIgnoreFilter` drops `ViewIgnoreActionTypes` (readonly's list minus `editor.loadJson` / `editor.clear`), letting `Tag.shared` reach the store.
  - `undo` / `redo` no-op while a view is active.
- **Leave a view and move in two dispatches.** Both seams classify a batch by the state it enters with. So leaving a view and moving the document are two dispatches. `goToErdTable` (`components/erd/canvas/table/goToErd.ts`) is the model, and `e2e/specs/visualization-flow.spec.ts` asserts what the host hears.

### Foreign key columns

- **Foreign key names come from `toForeignKeyNames`** (`engine/modules/relationship/fkColumns.ts`). It is the one place they are named. The pointer draw (`selectTableAction$`), `addRelationshipAction$` and a New column row of Map Columns (`mapColumnsAction$`, through `toForeignKeyActions`) all run it. `fkColumns.test.ts` pins each case below.
- **A one-word key gets the table prefix.** A key of one word (`id`, `ID`, `uuid`, `id2`; `isSingleWord`) gets the parent table and an underscore in front. A key of several words (`member_id`, `userId`, `UserID`) or equal to the table name keeps its name. A name the child already holds is numbered `_2`, `_3`.
  - Only an equal name escapes the prefix, an owner decision. A key of one word that holds the table name gets it too (`user.userid` gives `user_userid`, `회원.회원번호` gives `회원_회원번호`).
- **Words split on case and non-letters.**
  - Any character but a letter, mark or digit splits words, so `_id` and `order-no` keep their names.
  - Words split where camelCase splits them, so `IDs` and `UUIDv4` keep theirs too. `Ids` is one word, as is a name in one case (`memberid`, `USERID`: `members_memberid`).
  - Words also split where a letter without case (`\p{Lo}` or `\p{Lm}`: Hangul, kana with its `ー`, Han) meets a cased one, either way. So `회원ID`, `ユーザーID`, `用户ID` and `IDカード` keep theirs, while `회원번호` is one word.
  - Digits and marks are passed over when reading case, so `SHA256sum` is several words and `md5sum` one.
- **The table name is used as written**, dots and spaces included (`public.users` gives `public.users_id`), an owner decision. Such a column makes valid DDL only under a quoting `bracketType`. There every generator also keeps the whole name in the relationship's constraint (`"FK_public.users_TO_orders"`).
  - Unquoted, SQL Server, Oracle, MySQL, MariaDB and PostgreSQL give that constraint the table part alone (`FK_users_TO_orders`; the SQL writers: `src/utils/schema-sql/AGENTS.md`). SQLite writes it unnamed. Snowflake and Databricks keep the whole name (`FK_public.users_TO_orders`).
- **Relating existing columns renames nothing.** That covers Map Columns, `erd_link_columns`, the importers and duplicates. Map Columns alone changes their type: it brings each child column it maps to its parent's type through the data type sync, in the same batch. It does so only while `settings.relationshipDataTypeSync` is on.
- **A serial key's copy takes its integer type** (owner decisions). `toReferenceDataType` (`relationship/referenceType.ts`, DOM-free for the peer) sets it, whatever the data type sync says.
  - PostgreSQL's own `smallserial`, `bigserial` and `serial2` / `4` / `8` map by PostgreSQL's types under any database.
  - A bare `serial` maps by `settings.database`: `integer` in PostgreSQL, `bigint unsigned` in MySQL and MariaDB, kept elsewhere.
  - Only a whole name maps, in capitals when the key's is. No saved document is migrated.
  - The data type sync (`table-column/utils/dataType.ts`) maps a key's change into its foreign keys the same way. It carries a foreign key's change back to its key unless the key's type is serial, which keeps it and stops the change there.
- **`mcp-server`'s descriptions state these rules.** The `erd_add_relationship` and `erd_change_column_data_type` descriptions (`tools/copy.ts`) state them to agents, so they change with the code.

### Table groups

- **Membership is the table's `groupId`** (an owner decision). The model is in `engine/modules/table-group/`, and the DOM-free helpers in `utils/tableGroup.ts`, inside the peer graph. `groupId` is written through one register per table (`table.changeGroup`, path `groupId`). So a table is in one group at most, and two peers placing it converge on the later write.
  - A `groupId` naming no group in `doc.tableGroupIds` reads as none everywhere (`getTableGroupId`, `getTableGroupMemberIds`).
- **A group's box covers its members.** A group stores its own rect. Its box is that rect united with each member's rect grown by `TABLE_GROUP_PADDING`, and on top by `TABLE_GROUP_TITLE_HEIGHT` more. So a member that grows sticks out of nothing and writes nothing.
  - `padRect` and `getTableGroupRect` compute the box. `getTableGroupRect`'s `excludeTableIds` leaves out the tables a drag holds, and its `members` spares the walk over every table.
- **Membership reads a table's centre.** A membership test reads a table's centre in the topmost box (`findTableGroupAt`). The topmost box has the highest zIndex; of two at one zIndex, it is the later in `doc.tableGroupIds`.
  - `findTableGroupsAt` answers many points off one read of the boxes, as a drop does, and builds none for no point.
- **Read every group in one walk.** Whatever needs every group reads them out of one walk over the tables, never a walk per group. A pan step reads the content rect several times over, and a drag step reads the drop boxes.
  - `getTableGroupRects` gives every box (`seedTableGroupBoxes` / `growTableGroupBox`, which the content rect folds into its own pass).
  - `getTableGroupMembers` gives every member list.
- **A drop judges the loose selected tables.** `getTableGroupDrops` judges the selected tables no selected group carries. It reads no box with none to judge (a drag of groups alone). It hands each drop the box of the group it lands in.
  - A group the drag leaves standing reaches over the box it held as the drag began (`HeldTableGroupBoxes`; `src/components/erd/AGENTS.md`).
- **Removing a group is one dispatch.** `removeTableGroupAction$` clears every member's `groupId` and removes the group in one dispatch, so one undo brings back both. Removing a table needs nothing more.
- **A group moves with its members.** Moving a group (`moveTableGroupAction$`, and `moveAllAction$` over a selected one, `toMoveTableGroupActions`) moves its members by the same relative step in the same dispatch, tagged as a drag. A member selected beside the group moves once.
  - `tableGroup.move` and `tableGroup.changeColor` regroup with the table and memo streams, so a drag is one undo entry.
- **A drag carries its first step's tables.** A drag carries the tables its first step read (`getCarriedTableIds`), kept in the `MoveAllGesture` that `useMoveEntity` makes per press and hands every step. The history and the outbound compressor sum a burst's steps per table list and drop a list under 20 px. Otherwise a member a peer adds or takes out midway would leave a step applied here and never sent or undone.
- **Four paths select a group** (`SelectType.tableGroup`): a press, adding a group, an append's landing and a marquee that encloses its whole box.
  - A press (`selectTableGroupAction$`) raises the group among groups by `nextTableGroupZIndex`. `tableGroup.changeZIndex` is in no list, as `memo.changeZIndex` is in none.
  - The same press raises the group's tables over every other table and memo, in their own order, with `table.changeZIndex`, as a press on a table raises it, and sends none once they stand there. Otherwise a group drag draws them in the drag layer over the rest and its drop puts them back under it.
  - Adding a group selects it alone.
  - A marquee in the document takes a shown group only once it encloses the group's whole drawn box, edges included (`takenTableGroups` in `dragSelectAction$`, an owner decision of 2026-10-11). A centre rule, which tables and memos follow, would take a group with every marquee drawn inside it to pick a few of its tables, and the drag or Delete after it would reach the whole group.
  - Select all never takes a group. Delete (`removeSelectedAction$`, and `getRemovableColumns` reading a selected group as a selection beside the table) and the color picker reach it.
- **A paste or duplicate carries no `groupId`.** An append carries its document's groups under new ids, its tables put in them by their new ids (`toAppendTableGroups`).
  - A file's rects move with the block, which starts at their corners too.
  - A grid or placed layout wraps each group with members round where they land, the block starting at the wrapped corners as well (`toLayoutGroupRects`).
  - Duplicates and the clipboard: `src/utils/AGENTS.md`. Automatic placement, which keeps table groups together: `src/services/AGENTS.md`.
- **A resize is one undo entry per write.** `tableGroup.resize` is undone to the rect the group stored before it. A sash drag writes it once, at its end (`src/components/erd/AGENTS.md`).
- **A drop's regroup undoes with the drag.** A drop's `table.changeGroup` carries the `groupId` it replaces as `prevValue`, and `Tag.drag`. The `@@move` regroup in `rx-store.ts` takes it in by tag (`groupByStreamActions`), so its undo closes into the drag's entry. The undo builder reads `prevValue`, since that entry is built once the reducer has run.
- **Adding a group takes a name and color.** `addTableGroupAction$` and `addTableGroupFromTablesAction$` take an optional name and color. `mcp-server`'s `erd_add_table_group` sets them in the batch that adds the group, where the editor names a group by its name editor afterwards.
- **`peer.js` exports both group barrels** for `mcp-server`'s group tools. Those tools send every group change type but `tableGroup.moveTo`, which no gesture sends either.

### Peer store internals

The peer entry's Node and import rules and its key set spec: `src/peer/AGENTS.md`.

- **Seven `peer.js` keys serve specs alone**: `createEngineContext`, `ChangeActionTypes`, `StreamActionTypes`, `SharedFollowingActionTypes`, `SelectType`, `settingsActions$` and `CanvasType` (a tab the snapshot and fingerprint specs move to).
  - `defaultToWidth` serves those specs and also sizes tables for `erd_list` (`mcp-server`'s `src/tools/outline.ts`).
  - Keep them in the entry. `mcp-server` holds each tool declaration to what the engine measurably does, so its specs need the real context, the real text measure, the real type lists and the real generator barrel. A `./peer/testing.js` subpath would make a fourth entry and split the chunks again.
  - `mcp-server`'s `src/peerSurface.test.ts` proves no key is dead.
  - `app`'s Drive, fingerprint, IndexedDB schema service and collaborative host specs import the entry too (`createPeerStore`, the table, column, table group and settings barrels, `CanvasType`, `LockSettingType`, and `SharedFollowingActionTypes`, which `documentController.test.ts` holds `NON_EDIT_ACTIONS` to), and so do `vuerd-vscode`'s `src/runtime-value.test.ts` and `obsidian-plugin`'s `src/__test-utils__/diagram.ts` (`createPeerStore` and the table and column barrels), so a change to the key set runs the `test` of `app`, `vuerd-vscode` and `obsidian-plugin` beside `mcp-server`'s.
- **Labelled undo units are the peer's bookkeeping**, not the engine's. The engine's history knows only entries.
  - `dispatch(actions, { label })` records one unit.
  - `group(label, run)` gathers the dispatches `run` makes into one unit under its own label. A group inside a group joins the outer one, and a group that dispatched nothing leaves none.
  - `undo`, `redo` and `setInitialValue` throw inside a group, since the unit would no longer match the history.
  - `undo` pops the newest unit that made an entry and names the labels it passed over.
  - `setInitialValue` forgets all of them.
- **`manualStreamFlush` closes a stream group on demand.** `createRxStore(context, { manualStreamFlush })` and `createSharedStore(store, config, { manualStreamFlush })` close a stream group (colors, memo resizes) on `flushStreamBuffers()`. That replaces `groupByStreamActions`' 200 ms quiet period. The flush goes through `flushOnNotifier` over a `Subject` the store owns.
  - Each store owns its tick count too. The rx-store has one, in its single history stage. The shared store has `FLUSH_TICKS = 2`: its compressor stands on each side of the circuit breaker, and its second stage arms too late for the first tick.
  - So `stream-flush.ts` flushes history first, then the outbound pipe, and knows neither the count nor an rxjs type.
  - Without the flag the rx-store's `flushStreamBuffers` is a no-op and the editor keeps its timing. A stream edit reaches peers after the two stages' 200 ms each, 400 ms.
  - The shared store's flush still works there (`quietPeriodOrNotifier`: the quiet period or the flush, whichever comes first). So a host can send a drag still held back before it lets the store go. `obsidian-plugin` does when a tab closes, so the other tabs of its file keep what it held.
  - The shared store takes the option as an internal third argument (`SharedStoreInternalOptions`). So neither `SharedStoreConfig` nor the config `getSharedStore` takes carries a stream option.
- **Deep-import the two stream operators.** `flushOnNotifier` and `createSharedStreamActionsCompressor` are deep-imported and stay out of the `rx-operators` barrel. `rx-operators/index.test.ts` pins the barrel's export set, as it keeps `readonlyIgnoreFilter` out.
- **`observable: false` keeps a Node store plain.** `createRxStore`'s internal `observable` option (default true), set to false, keeps the state a plain object.
  - r-html's reactive proxy reads `value instanceof Node`, a `ReferenceError` in plain Node. The replica store never hit it, because it already ran with observation off.
  - The peer passes false and first dispatches `changeViewportAction({ width: 0, height: 0 })`, so a load never reaches the pull's view lookup.
  - `RxStoreOptions` is not public surface.
- **A replicated sort sends `table.moveTo`, never `table.sort`.** `sortTable` places by each replica's own `toWidth`, so replaying it lands tables apart.
  - `sortTablesToMoveAction$` runs the reducer on copies of the live tables and groups. It sends the absolute points, and for each group with members its `tableGroup.resize`, in one undoable batch.
  - An import sends no `table.sort` either. `withGridPoints` (`editor/generator.actions.ts`) runs the reducer on a copy of the parsed document, its widths measured as the sender's store measures them.
  - `withGridPoints` writes each table's point and each group's rect into the `loadJson` value, which every peer loads as it is. The load reducer measures widths again with its own fonts.
  - `toLayoutPoints` sorts an append's grid on its copy the same way.
  - The reducer and its change type stay for an older editor that still sends one.

## Testing Requirements

- `engine/replication-store.test.ts` pins `changed` for these cases:
  - a new document and a new empty file (every lock on);
  - the viewport locked and unlocked, and a locked view held at its lock wherever the screen goes;
  - a zoom saved with the origin it moved once unlocked;
  - a tab switch, and a language locked and unlocked;
  - a batch of the switch the locks replaced, and a file saved before the locks;
  - another machine's widths, which reopen to its bytes, and a file without the origin;
  - an add undone within one change, an edit on a removed table, and a load that restacks alone;
  - a relationship left with no end column;
  - a scroll or zoom 0, 3 and 7 ms into a stale file's load;
  - a measure that moves after the load, and the registers a join brings in before the first change.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
