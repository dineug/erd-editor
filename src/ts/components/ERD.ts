import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import { defaultWidth, defaultHeight } from "./Layout";
import {
  Menu,
  createContextmenuERD,
  createContextmenuRelationship,
} from "@src/core/Contextmenu";
import { Bus, Move } from "@src/core/Event";
import { keymapMatch, MoveKey, moveKeys } from "@src/core/Keymap";
import { getParentElement, getData } from "@src/core/Helper";
import { relationshipMenus } from "@src/core/Contextmenu";
import { getBase64Icon } from "@src/core/Icon";
import { Relationship } from "@src/core/store/Relationship";
import { Command, CommandType } from "@src/core/Command";
import {
  addTable,
  removeTable,
  selectTable,
  selectEndTable,
  selectAllTable,
} from "@src/core/command/table";
import {
  addColumn,
  removeColumn,
  changeColumnNotNull,
  changeColumnPrimaryKey,
} from "@src/core/command/column";
import {
  addMemo,
  removeMemo,
  selectEndMemo,
  selectAllMemo,
} from "@src/core/command/memo";
import { moveCanvas } from "@src/core/command/canvas";
import {
  focusMoveTable,
  editTable as editTableCommand,
  editEndTable,
  selectAllColumn,
  drawStartRelationship,
  drawEndRelationship,
  copyColumn,
  pasteColumn,
  findActive as findActiveCommand,
  findActiveEnd,
} from "@src/core/command/editor";
import "./erd/InputEdit";
import "./erd/Canvas";
import "./erd/CanvasSVG";
import "./erd/Memo";
import "./erd/Table";
import "./erd/table/Column";
import "./erd/table/ColumnKey";
import "./erd/table/ColumnNotNull";
import "./erd/table/ColumnDataType";
import "./erd/table/ColumnDataTypeHint";
import "./erd/Minimap";
import "./erd/minimap/MinimapHandle";
import "./erd/minimap/Table";
import "./erd/minimap/Column";
import "./erd/minimap/Memo";
import "./erd/DragSelect";
import "./erd/DrawRelationship";
import "./erd/Find";
import "./erd/find/FindTable";

@customElement("vuerd-erd")
class ERD extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;
  @property({ type: Boolean })
  contextmenu = false;
  @property({ type: Boolean })
  select = false;

  private selectX = 0;
  private selectY = 0;
  private selectGhostX = 0;
  private selectGhostY = 0;
  private contextmenuX = 0;
  private contextmenuY = 0;
  private contextmenuRelationship: Relationship | null = null;
  private subscriptionList: Subscription[] = [];
  private subMoveEnd: Subscription | null = null;
  private subMove: Subscription | null = null;
  private subDrawRelationship: Subscription | null = null;
  private menus: Menu[] = [];

  get styleMap() {
    const { drawRelationship } = this.context.store.editorState;
    const styleMap: any = {
      width: `${this.width}px`,
      height: `${this.height}px`,
    };
    if (drawRelationship) {
      styleMap.cursor = `url("${getBase64Icon(
        drawRelationship.relationshipType
      )}") 16 16, auto`;
    }
    return styleMap;
  }

  get erd() {
    return this.renderRoot.querySelector(".vuerd-erd");
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("ERD connectedCallback");
    const { store, eventBus, keymap } = this.context;
    const { mousedown$, keydown$ } = this.context.windowEventObservable;
    eventBus.on(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    this.subscriptionList.push(
      store.observe(store.canvasState, (name) => {
        const erd = this.erd;
        switch (name) {
          case "scrollTop":
            if (erd && erd.scrollTop !== store.canvasState.scrollTop) {
              erd.scrollTop = store.canvasState.scrollTop;
              this.onScrollValid();
            }
            break;
          case "scrollLeft":
            if (erd && erd.scrollLeft !== store.canvasState.scrollLeft) {
              erd.scrollLeft = store.canvasState.scrollLeft;
              this.onScrollValid();
            }
            break;
        }
      }),
      store.observe(store.editorState, (name) => {
        const { drawRelationship } = store.editorState;
        if (name === "drawRelationship") {
          this.unsubscribeDrawRelationship();
          if (drawRelationship !== null) {
            this.observeDrawRelationship();
          }
          this.requestUpdate();
        }
      }),
      mousedown$.subscribe(this.onMousedownWindow),
      keydown$.subscribe((event) => {
        const {
          focus,
          editTable,
          focusTable,
          copyColumns,
          findActive,
        } = store.editorState;
        if (focus) {
          if (keymapMatch(event, keymap.addTable)) {
            store.dispatch(addTable(store));
          }

          if (
            keymapMatch(event, keymap.addColumn) &&
            store.tableState.tables.some((table) => table.ui.active)
          ) {
            store.dispatch(addColumn(store), findActiveEnd());
          }

          if (keymapMatch(event, keymap.addMemo)) {
            store.dispatch(addMemo(store));
          }

          if (
            keymapMatch(event, keymap.removeTable) &&
            (store.tableState.tables.some((table) => table.ui.active) ||
              store.memoState.memos.some((memo) => memo.ui.active))
          ) {
            const batchCommand: Array<Command<CommandType>> = [];
            if (store.tableState.tables.some((table) => table.ui.active)) {
              batchCommand.push(removeTable(store));
            }
            if (store.memoState.memos.some((memo) => memo.ui.active)) {
              batchCommand.push(removeMemo(store));
            }
            store.dispatch(...batchCommand);
          }

          if (focusTable !== null && keymapMatch(event, keymap.removeColumn)) {
            const columns = focusTable.selectColumns;
            if (columns.length !== 0) {
              store.dispatch(
                removeColumn(
                  focusTable.id,
                  columns.map((column) => column.id)
                )
              );
            }
          }

          if (focusTable !== null && keymapMatch(event, keymap.primaryKey)) {
            const currentFocus = focusTable.currentFocus;
            if (
              currentFocus !== "tableName" &&
              currentFocus !== "tableComment"
            ) {
              const columnId = focusTable.currentFocusId;
              store.dispatch(
                changeColumnPrimaryKey(store, focusTable.id, columnId)
              );
            }
          }

          if (editTable === null && keymapMatch(event, keymap.selectAllTable)) {
            store.dispatch(selectAllTable(), selectAllMemo());
          }

          if (
            editTable === null &&
            keymapMatch(event, keymap.selectAllColumn)
          ) {
            store.dispatch(selectAllColumn());
          }

          if (
            focusTable !== null &&
            editTable === null &&
            moveKeys.some((moveKey) => moveKey === event.key)
          ) {
            store.dispatch(
              focusMoveTable(event.key as MoveKey, event.shiftKey)
            );
          }

          if (focusTable !== null && event.key === "Tab") {
            event.preventDefault();
            store.dispatch(focusMoveTable("ArrowRight", event.shiftKey));
          }

          if (focusTable !== null && keymapMatch(event, keymap.edit)) {
            if (editTable === null) {
              const currentFocus = focusTable.currentFocus;
              if (currentFocus === "columnNotNull") {
                const columnId = focusTable.currentFocusId;
                store.dispatch(
                  changeColumnNotNull(store, focusTable.id, columnId)
                );
              } else {
                store.dispatch(
                  editTableCommand(
                    focusTable.currentFocusId,
                    focusTable.currentFocus
                  )
                );
              }
            } else {
              store.dispatch(editEndTable());
            }
          }

          relationshipMenus.forEach((relationshipMenu) => {
            if (keymapMatch(event, keymap[relationshipMenu.keymapName])) {
              store.dispatch(
                drawStartRelationship(relationshipMenu.relationshipType)
              );
            }
          });

          if (
            focusTable !== null &&
            editTable === null &&
            keymapMatch(event, keymap.copyColumn)
          ) {
            const columns = focusTable.selectColumns;
            if (columns.length !== 0) {
              store.dispatch(
                copyColumn(
                  focusTable.id,
                  columns.map((column) => column.id)
                )
              );
            }
          }

          if (
            editTable === null &&
            copyColumns.length !== 0 &&
            keymapMatch(event, keymap.pasteColumn) &&
            store.tableState.tables.some((table) => table.ui.active)
          ) {
            store.dispatch(pasteColumn(store));
          }

          if (keymapMatch(event, keymap.find)) {
            store.dispatch(findActiveCommand());
          }

          if (keymapMatch(event, keymap.stop)) {
            const batchCommand: Array<Command<CommandType>> = [
              selectEndMemo(),
              drawEndRelationship(),
            ];
            if (findActive) {
              const table = store.tableState.tables.find(
                (table) => table.ui.active
              );
              if (table) {
                batchCommand.push(selectTable(store, false, table.id));
              }
            } else {
              batchCommand.push(selectEndTable());
            }
            store.dispatch(...batchCommand);
          }

          if (keymapMatch(event, keymap.undo)) {
            store.undo();
          }

          if (keymapMatch(event, keymap.redo)) {
            store.redo();
          }
        }
      })
    );
    const erd = this.erd;
    if (erd) {
      requestAnimationFrame(() => {
        erd.scrollTop = store.canvasState.scrollTop;
        erd.scrollLeft = store.canvasState.scrollLeft;
        this.onScrollValid();
      });
    }
  }
  firstUpdated() {
    Logger.debug("ERD firstUpdated");
    const { store } = this.context;
    requestAnimationFrame(() => {
      const erd = this.erd;
      if (erd) {
        erd.scrollTop = store.canvasState.scrollTop;
        erd.scrollLeft = store.canvasState.scrollLeft;
        this.onScrollValid();
      }
    });
  }
  disconnectedCallback() {
    Logger.debug("ERD disconnectedCallback");
    const { eventBus } = this.context;
    this.onMoveEnd();
    this.unsubscribeDrawRelationship();
    eventBus.off(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("ERD render");
    const { drawRelationship } = this.context.store.editorState;
    return html`
      <div
        class="vuerd-erd"
        style=${styleMap(this.styleMap)}
        @mousedown=${this.onMousedown}
        @touchstart=${this.onTouchstart}
        @contextmenu=${this.onContextmenu}
      >
        <vuerd-canvas></vuerd-canvas>
        <vuerd-minimap
          .width=${this.width}
          .height=${this.height}
        ></vuerd-minimap>
        ${this.contextmenu
          ? html`
              <vuerd-contextmenu
                .menus=${this.menus}
                .x=${this.contextmenuX}
                .y=${this.contextmenuY}
                .relationship=${this.contextmenuRelationship}
              ></vuerd-contextmenu>
            `
          : ""}
        ${this.select
          ? html`
              <vuerd-drag-select
                .x=${this.selectX}
                .y=${this.selectY}
                .ghostX=${this.selectGhostX}
                .ghostY=${this.selectGhostY}
                @select-end=${this.onSelectEnd}
              ></vuerd-drag-select>
            `
          : ""}
        ${drawRelationship?.start
          ? html`
              <vuerd-draw-relationship
                .draw=${drawRelationship}
              ></vuerd-draw-relationship>
            `
          : ""}
      </div>
    `;
  }

  private onContextmenuEnd = (event: Event) => {
    this.contextmenu = false;
    this.contextmenuRelationship = null;
  };
  private onMoveEnd = (event?: MouseEvent | TouchEvent) => {
    this.subMoveEnd?.unsubscribe();
    this.subMove?.unsubscribe();
    this.subMoveEnd = null;
    this.subMove = null;
  };
  private onMove = ({ event, movementX, movementY }: Move) => {
    if (event.type === "mousemove") {
      event.preventDefault();
    }
    const erd = this.erd;
    if (erd) {
      erd.scrollTop -= movementY;
      erd.scrollLeft -= movementX;
      const { store } = this.context;
      store.dispatch(moveCanvas(erd.scrollTop, erd.scrollLeft));
    }
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    if (!el.closest(root.host.localName)) {
      this.contextmenu = false;
    }
  };

  private onContextmenu(event: MouseEvent) {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const { store } = this.context;
    this.contextmenuX = event.x;
    this.contextmenuY = event.y;
    if (!el.closest(".vuerd-relationship")) {
      this.menus = createContextmenuERD(this.context);
      this.contextmenu = true;
    } else {
      const g = getParentElement(el, "g");
      if (g) {
        const id = g.dataset.id;
        if (id) {
          const { relationships } = this.context.store.relationshipState;
          const relationship = getData(relationships, id);
          if (relationship) {
            this.menus = createContextmenuRelationship(store, relationship);
            this.contextmenuRelationship = relationship;
            this.contextmenu = true;
          }
        }
      }
    }
  }
  private onMousedown(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-contextmenu")) {
      this.contextmenu = false;
    }
    if (
      !el.closest(".vuerd-contextmenu") &&
      !el.closest(".vuerd-table") &&
      !el.closest(".vuerd-memo") &&
      !el.closest(".vuerd-minimap") &&
      !el.closest(".vuerd-minimap-handle")
    ) {
      const { store } = this.context;
      const { moveEnd$, move$ } = this.context.windowEventObservable;
      store.dispatch(selectEndTable(), selectEndMemo());
      if (event.ctrlKey) {
        this.selectX = event.x;
        this.selectY = event.y;
        this.selectGhostX = event.offsetX;
        this.selectGhostY = event.offsetY;
        this.select = true;
      } else {
        this.onMoveEnd();
        this.subMoveEnd = moveEnd$.subscribe(this.onMoveEnd);
        this.subMove = move$.subscribe(this.onMove);
      }
    }
  }
  private onTouchstart(event: TouchEvent) {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-contextmenu")) {
      this.contextmenu = false;
    }
    if (
      !el.closest(".vuerd-contextmenu") &&
      !el.closest(".vuerd-table") &&
      !el.closest(".vuerd-memo") &&
      !el.closest(".vuerd-minimap") &&
      !el.closest(".vuerd-minimap-handle")
    ) {
      const { store } = this.context;
      const { moveEnd$, move$ } = this.context.windowEventObservable;
      store.dispatch(selectEndTable(), selectEndMemo());
      this.onMoveEnd();
      this.subMoveEnd = moveEnd$.subscribe(this.onMoveEnd);
      this.subMove = move$.subscribe(this.onMove);
    }
  }
  private onSelectEnd() {
    this.select = false;
  }
  private onScrollValid() {
    const { store } = this.context;
    const erd = this.erd;
    if (
      erd &&
      (erd.scrollTop !== store.canvasState.scrollTop ||
        erd.scrollLeft !== store.canvasState.scrollLeft)
    ) {
      store.dispatch(moveCanvas(erd.scrollTop, erd.scrollLeft));
    }
  }

  private observeDrawRelationship() {
    const { store } = this.context;
    const { drawRelationship } = this.context.store.editorState;
    if (drawRelationship) {
      store.observe(drawRelationship, () => this.requestUpdate());
    }
  }
  private unsubscribeDrawRelationship() {
    this.subDrawRelationship?.unsubscribe();
    this.subDrawRelationship = null;
  }
}
