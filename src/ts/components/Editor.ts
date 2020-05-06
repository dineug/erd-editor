import { LitElement, html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { cache } from "lit-html/directives/cache";
import { Subscription } from "rxjs";
import { Layout, defaultWidth, defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { keymapMatch, KeymapKey, KeymapOption } from "@src/core/Keymap";
import { Bus } from "@src/core/Event";
import { EditorContext, createEditorContext } from "@src/core/EditorContext";
import { createJsonFormat } from "@src/core/File";
import { loadJson, clear } from "@src/core/command/editor";
import { ThemeKey } from "@src/core/Theme";
import { Theme, Keymap, Editor } from "@src/types";
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

@customElement("vuerd-editor")
class EditorModel extends LitElement implements Editor {
  static get styles() {
    return Layout;
  }

  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

  context: EditorContext;

  private subscriptionList: Subscription[] = [];
  private help = false;
  private importErrorDDL = false;
  private importErrorDDLMessage = "";

  get value() {
    const { store } = this.context;
    return JSON.stringify(createJsonFormat(store), (key, value) => {
      if (key === "_show") {
        return undefined;
      }
      return value;
    });
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
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, keymap, eventBus } = this.context;
    const { keydown$ } = this.context.windowEventObservable;
    this.subscriptionList.push(
      store.change$.subscribe((value) => {
        this.dispatchEvent(
          new CustomEvent("change", {
            detail: {
              value,
            },
          })
        );
      }),
      store.observe(store.canvasState, (name) => {
        if (name === "canvasType") {
          this.requestUpdate();
        }
      }),
      keydown$.subscribe((event) => {
        Logger.debug(`
        metaKey: ${event.metaKey},
        ctrlKey: ${event.ctrlKey},
        altKey: ${event.altKey},
        shiftKey: ${event.shiftKey},
        code: ${event.code},
        key: ${event.key}
        `);
        const { focus } = store.editorState;
        if (focus) {
          if (keymapMatch(event, keymap.stop)) {
            eventBus.emit(Bus.Help.close);
            eventBus.emit(Bus.ImportErrorDDL.close);
            eventBus.emit(Bus.Filter.close);
            eventBus.emit(Bus.Find.close);
          }
        }
      })
    );
    eventBus.on(Bus.Editor.importErrorDDL, this.onImportErrorDDL);
  }
  firstUpdated() {
    const span = this.renderRoot.querySelector(
      ".vuerd-text-width"
    ) as HTMLSpanElement;
    this.context.helper.setSpan(span);
  }
  disconnectedCallback() {
    const { store, windowEventObservable, eventBus } = this.context;
    store.destroy();
    windowEventObservable.destroy();
    eventBus.off(Bus.Editor.importErrorDDL, this.onImportErrorDDL);
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { canvasType } = this.context.store.canvasState;
    const {
      canvas,
      table,
      tableActive,
      focus,
      keyPK,
      keyFK,
      keyPFK,
      relationshipActive,
      font,
      fontActive,
      fontPlaceholder,
      contextmenu,
      contextmenuActive,
      edit,
      mark,
      columnSelect,
      columnActive,
      minimapShadow,
      minimapHandle,
      scrollBarThumb,
      scrollBarThumbActive,
      dragSelect,
      menubar,
      visualization,
      help,
    } = this.context.theme;
    return html`
      <style>
        @import url("https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap");
        :host {
          --vuerd-font-family: "Noto Sans", sans-serif;
          --vuerd-color-canvas: ${canvas};
          --vuerd-color-table: ${table};
          --vuerd-color-table-active: ${tableActive};
          --vuerd-color-focus: ${focus};
          --vuerd-color-key-pk: ${keyPK};
          --vuerd-color-key-fk: ${keyFK};
          --vuerd-color-key-pfk: ${keyPFK};
          --vuerd-color-relationship-active: ${relationshipActive};
          --vuerd-color-font: ${font};
          --vuerd-color-font-active: ${fontActive};
          --vuerd-color-font-placeholder: ${fontPlaceholder};
          --vuerd-color-contextmenu: ${contextmenu};
          --vuerd-color-contextmenu-active: ${contextmenuActive};
          --vuerd-color-edit: ${edit};
          --vuerd-color-mark: ${mark};
          --vuerd-color-column-select: ${columnSelect};
          --vuerd-color-column-active: ${columnActive};
          --vuerd-color-minimap-shadow: ${minimapShadow};
          --vuerd-color-minimap-handle: ${minimapHandle};
          --vuerd-color-scrollbar-thumb: ${scrollBarThumb};
          --vuerd-color-scrollbar-thumb-active: ${scrollBarThumbActive};
          --vuerd-color-drag-select: ${dragSelect};
          --vuerd-color-menubar: ${menubar};
          --vuerd-color-visualization: ${visualization};
          --vuerd-color-help: ${help};
        }
      </style>
      <div
        class="vuerd-editor"
        style=${styleMap({
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
      >
        <vuerd-menubar @help-start=${this.onHelp}></vuerd-menubar>
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
      </div>
    `;
  }

  private onImportErrorDDL = (event: CustomEvent) => {
    this.importErrorDDLMessage = event.detail.message;
    this.importErrorDDL = true;
    this.requestUpdate();
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

  focus() {
    this.context.store.editorState.focus = true;
  }
  blur() {
    this.context.store.editorState.focus = false;
  }
  clear() {
    const { store } = this.context;
    store.dispatch(clear());
  }
  setTheme(theme: Theme) {
    const editorTheme = this.context.theme;
    if (typeof theme === "object" && theme !== null) {
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
    if (typeof keymap === "object" && keymap !== null) {
      Object.keys(keymap).forEach((key) => {
        const k = key as KeymapKey;
        if (editorKeymap[k] !== undefined && Array.isArray(keymap[k])) {
          editorKeymap[k] = keymap[k] as KeymapOption[];
        }
      });
    }
  }
}

@customElement("erd-editor")
class EditorAlias extends EditorModel {}
