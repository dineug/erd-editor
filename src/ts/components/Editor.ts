import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { cache } from "lit-html/directives/cache";
import { Subscription, fromEvent, merge } from "rxjs";
import { groupBy, mergeMap, throttleTime, filter } from "rxjs/operators";
import { RxElement } from "./EditorElement";
import { Layout, defaultWidth, defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { keymapMatch, KeymapKey, KeymapOption } from "@src/core/Keymap";
import { Bus } from "@src/core/Event";
import { EditorContext, createEditorContext } from "@src/core/EditorContext";
import { createJsonStringify } from "@src/core/File";
import { loadJson, initLoadJson, clear } from "@src/core/command/editor";
import { sortTable } from "@src/core/command/table";
import { ThemeKey } from "@src/core/Theme";
import { isObject } from "@src/core/Helper";
import { DDLParser } from "@dineug/sql-ddl-parser";
import { createJson } from "@src/core/SQLParserToJson";
import { createDDL } from "@src/core/SQL";
import { Database, databaseList } from "@src/core/store/Canvas";
import { ERDEditorElement, Theme, Keymap, User } from "@src/types";
import "./Icon";
import "./Contextmenu";
import "./Sash";
import "./Menubar";
import "./ERD";
import "./Grid";
import "./Visualization";
import "./SQL";
import "./GeneratorCode";
import "./Help";
import "./ImportErrorDDL";
import "./Setting";
import "./TableProperties";

@customElement("vuerd-editor")
class Editor extends RxElement implements ERDEditorElement {
  static get styles() {
    return Layout;
  }

  @property({ type: Number, reflect: true })
  width = defaultWidth;
  @property({ type: Number, reflect: true })
  height = defaultHeight;
  @property({ type: Boolean, reflect: true, attribute: "automatic-layout" })
  automaticLayout = false;

  context: EditorContext;

  private help = false;
  private importErrorDDL = false;
  private importErrorDDLMessage = "";
  private setting = false;
  private tableProperties = false;
  private tablePropertiesId = "";
  private subShare: Subscription | null = null;
  private resizeObserver: any = null;

  get value() {
    const { store } = this.context;
    return createJsonStringify(store);
  }

  set value(json: string) {
    const { store } = this.context;
    if (typeof json === "string" && json.trim() !== "") {
      store.dispatch(loadJson(json));
    } else {
      store.dispatch(clear());
    }
  }

  constructor() {
    super();
    this.context = createEditorContext();
    // @ts-ignore
    if (ResizeObserver) {
      // @ts-ignore
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry: any) => {
          const { width, height } = entry.contentRect;
          this.width = width;
          this.height = height;
        });
      });
    }
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus, helper } = this.context;
    this.subscriptionList.push(
      store.change$.subscribe(() =>
        this.dispatchEvent(new CustomEvent("change"))
      ),
      store.observe(store.canvasState, (name) => {
        if (name === "canvasType") {
          this.requestUpdate();
        }
      }),
      store.observe(store.editorState, (name) => {
        const {
          editTable,
          editFilter,
          findActive,
          filterActive,
        } = store.editorState;
        if (
          (name === "editTable" && editTable === null) ||
          (name === "editFilter" && editFilter === null && filterActive) ||
          (name === "findActive" && !findActive)
        ) {
          helper.focus();
        }
      }),
      eventBus.on(Bus.Editor.importErrorDDL).subscribe(this.onImportErrorDDL),
      eventBus.on(Bus.Editor.tableProperties).subscribe(this.onTableProperties)
    );
  }
  firstUpdated() {
    Logger.debug("Editor firstUpdated");
    const { store, keymap, eventBus, helper } = this.context;
    const editor = this.renderRoot.querySelector(
      ".vuerd-editor"
    ) as HTMLElement;
    const span = this.renderRoot.querySelector(
      ".vuerd-text-width"
    ) as HTMLSpanElement;
    const input = this.renderRoot.querySelector(
      ".vuerd-editor-focus"
    ) as HTMLInputElement;

    helper.setSpan(span);
    helper.setInput(input);
    helper.focus();
    if (this.automaticLayout) {
      if (this.resizeObserver === null) {
        Logger.warn("not supported ResizeObserver");
      } else {
        this.resizeObserver.observe(editor);
      }
    }
    this.subscriptionList.push(
      fromEvent<KeyboardEvent>(editor, "keydown")
        .pipe(
          groupBy((event) => event.code === "Enter"),
          mergeMap((group$) =>
            group$.key
              ? group$.pipe(
                  filter((event) => event.key !== "Process"),
                  throttleTime(100)
                )
              : group$
          )
        )
        .subscribe((event) => {
          Logger.debug(`
            metaKey: ${event.metaKey},
            ctrlKey: ${event.ctrlKey},
            altKey: ${event.altKey},
            shiftKey: ${event.shiftKey},
            code: ${event.code},
            key: ${event.key}
          `);
          helper.keydown$.next(event);
          if (keymapMatch(event, keymap.stop)) {
            eventBus.emit(Bus.Help.close);
            eventBus.emit(Bus.ImportErrorDDL.close);
            eventBus.emit(Bus.Filter.close);
            eventBus.emit(Bus.Find.close);
            eventBus.emit(Bus.Setting.close);
            eventBus.emit(Bus.TableProperties.close);
          }
        }),
      merge(
        fromEvent(editor, "mousedown"),
        fromEvent(editor, "touchstart")
      ).subscribe(this.onFocus)
    );
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      if (propName === "automaticLayout") {
        const editor = this.renderRoot.querySelector(".vuerd-editor");
        if (this.resizeObserver === null) {
          Logger.warn("not supported ResizeObserver");
        } else if (this.automaticLayout && editor) {
          this.resizeObserver.observe(editor);
        } else if (editor) {
          this.resizeObserver.unobserve(editor);
        }
      }
    });
  }
  disconnectedCallback() {
    const { store, windowEventObservable, helper } = this.context;
    [store, windowEventObservable, helper].forEach((obj) => obj.destroy());
    this.subShare?.unsubscribe();
    this.resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  render() {
    const { canvasType } = this.context.store.canvasState;
    const { theme } = this.context;
    return html`
      <style type="text/css">
        @import url("https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap");
        :host {
          --vuerd-font-family: "Noto Sans", sans-serif;
          --vuerd-color-canvas: ${theme.canvas};
          --vuerd-color-table: ${theme.table};
          --vuerd-color-table-active: ${theme.tableActive};
          --vuerd-color-focus: ${theme.focus};
          --vuerd-color-key-pk: ${theme.keyPK};
          --vuerd-color-key-fk: ${theme.keyFK};
          --vuerd-color-key-pfk: ${theme.keyPFK};
          --vuerd-color-font: ${theme.font};
          --vuerd-color-font-active: ${theme.fontActive};
          --vuerd-color-font-placeholder: ${theme.fontPlaceholder};
          --vuerd-color-contextmenu: ${theme.contextmenu};
          --vuerd-color-contextmenu-active: ${theme.contextmenuActive};
          --vuerd-color-edit: ${theme.edit};
          --vuerd-color-column-select: ${theme.columnSelect};
          --vuerd-color-column-active: ${theme.columnActive};
          --vuerd-color-minimap-shadow: ${theme.minimapShadow};
          --vuerd-color-scrollbar-thumb: ${theme.scrollBarThumb};
          --vuerd-color-scrollbar-thumb-active: ${theme.scrollBarThumbActive};
          --vuerd-color-menubar: ${theme.menubar};
          --vuerd-color-visualization: ${theme.visualization};
        }
      </style>
      <div
        class="vuerd-editor"
        style=${styleMap({
          width: this.automaticLayout ? `100%` : `${this.width}px`,
          height: this.automaticLayout ? `100%` : `${this.height}px`,
        })}
      >
        <vuerd-menubar
          @help-start=${this.onHelp}
          @setting-start=${this.onSetting}
        ></vuerd-menubar>
        ${cache(
          canvasType === "ERD"
            ? html`
                <vuerd-erd
                  .width=${this.width}
                  .height=${this.height}
                ></vuerd-erd>
              `
            : ""
        )}
        ${canvasType === "Grid"
          ? html`<vuerd-grid .height=${this.height}></vuerd-grid>`
          : canvasType === "Visualization"
          ? html`
              <vuerd-visualization .width=${this.width}></vuerd-visualization>
            `
          : canvasType === "SQL"
          ? html`<vuerd-sql></vuerd-sql>`
          : canvasType === "GeneratorCode"
          ? html`<vuerd-generator-code></vuerd-generator-code>`
          : ""}
        <span class="vuerd-text-width"></span>
        <input class="vuerd-editor-focus" type="text" />
        ${this.help
          ? html`<vuerd-help
              .width=${this.width}
              @close=${this.onHelpEnd}
            ></vuerd-help>`
          : ""}
        ${this.importErrorDDL
          ? html`
              <vuerd-import-error-ddl
                .width=${this.width}
                .message=${this.importErrorDDLMessage}
                @close=${this.onImportErrorDDLEnd}
              ></vuerd-import-error-ddl>
            `
          : ""}
        ${this.setting
          ? html`
              <vuerd-setting
                .width=${this.width}
                @close=${this.onSettingEnd}
              ></vuerd-setting>
            `
          : ""}
        ${this.tableProperties
          ? html`
              <vuerd-table-properties
                .width=${this.width}
                .tableId=${this.tablePropertiesId}
                @close=${this.onTablePropertiesEnd}
              ></vuerd-table-properties>
            `
          : ""}
      </div>
    `;
  }

  private onImportErrorDDL = (event: CustomEvent) => {
    this.importErrorDDLMessage = event.detail.message;
    this.importErrorDDL = true;
    this.requestUpdate();
  };
  private onTableProperties = (event: CustomEvent) => {
    this.tablePropertiesId = event.detail.tableId;
    this.tableProperties = true;
    this.requestUpdate();
  };
  private onFocus = (event: Event) => {
    Logger.debug("Editor onFocus");
    const { helper } = this.context;
    const el = event.target as HTMLElement;
    if (
      el.localName !== "input" &&
      el.localName !== "textarea" &&
      !el.closest(".vuerd-grid") &&
      !el.closest(".vuerd-sql") &&
      !el.closest(".vuerd-generator-code") &&
      !el.closest(".vuerd-tab-sql") &&
      !el.closest(".vuerd-tab-generator-code") &&
      !el.closest(".tui-grid-layer-selection")
    ) {
      setTimeout(() => {
        helper.focus();
      }, 0);
    }
  };

  private onHelp() {
    this.help = true;
    this.requestUpdate();
  }
  private onHelpEnd() {
    this.help = false;
    this.requestUpdate();
  }
  private onImportErrorDDLEnd() {
    this.importErrorDDL = false;
    this.importErrorDDLMessage = "";
    this.requestUpdate();
  }
  private onSetting() {
    this.setting = true;
    this.requestUpdate();
  }
  private onSettingEnd() {
    this.setting = false;
    this.requestUpdate();
  }
  private onTablePropertiesEnd() {
    this.tableProperties = false;
    this.tablePropertiesId = "";
    this.requestUpdate();
  }

  focus() {
    const { helper } = this.context;
    helper.focus();
  }
  blur() {
    const { helper } = this.context;
    helper.blur();
  }
  initLoadJson(json: string) {
    if (typeof json === "string" && json.trim() !== "") {
      const { store } = this.context;
      store.dispatch(initLoadJson(json));
    }
  }
  loadSQLDDL(sql: string) {
    if (typeof sql === "string" && sql.trim() !== "") {
      const { store, helper } = this.context;
      const statements = DDLParser(sql);
      const json = createJson(statements, helper, store.canvasState.database);
      store.dispatch(loadJson(json), sortTable());
    }
  }
  clear() {
    const { store } = this.context;
    store.dispatch(clear());
  }
  setTheme(theme: Theme) {
    const editorTheme = this.context.theme;
    if (isObject(theme)) {
      Object.keys(theme).forEach((key) => {
        const k = key as ThemeKey;
        if (editorTheme[k] !== undefined && typeof theme[k] === "string") {
          editorTheme[k] = theme[k] as string;
        }
      });
    }
    this.requestUpdate();
  }
  setKeymap(keymap: Keymap) {
    const editorKeymap = this.context.keymap;
    if (isObject(keymap)) {
      Object.keys(keymap).forEach((key) => {
        const k = key as KeymapKey;
        if (editorKeymap[k] !== undefined && Array.isArray(keymap[k])) {
          editorKeymap[k] = keymap[k] as KeymapOption[];
        }
      });
    }
  }
  setUser(user: User) {
    const { store } = this.context;
    if (isObject(user) && user.name) {
      store.user.name = user.name;
    }
  }

  sharePull(effect: (commands: any) => void) {
    if (typeof effect === "function") {
      const { store } = this.context;
      this.subShare?.unsubscribe();
      this.subShare = null;
      this.subShare = store.share$.subscribe(effect);
      store.editorState.undoManager = false;
    }
  }
  sharePush(commands: any) {
    if (Array.isArray(commands)) {
      const { store } = this.context;
      store.dispatch(...commands);
      store.editorState.undoManager = false;
    }
  }
  getSQLDDL(database?: Database) {
    const { store } = this.context;
    if (database && databaseList.includes(database)) {
      return createDDL(store, database);
    }
    return createDDL(store);
  }
}

@customElement("erd-editor")
class EditorAlias extends Editor {}
