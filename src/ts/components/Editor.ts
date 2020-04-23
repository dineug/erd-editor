import { LitElement, html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { cache } from "lit-html/directives/cache";
import { Subscription } from "rxjs";
import { Layout, defaultWidth, defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { keymapMatch } from "@src/core/Keymap";
import { EditorContext, createEditorContext } from "@src/core/EditorContext";
import { Command } from "@src/core/Command";
import { selectEndTable } from "@src/core/command/table";
import { selectEndMemo } from "@src/core/command/memo";
import "./ERD";
import "./Canvas";
import "./CanvasSVG";
import "./Icon";
import "./Contextmenu";
import "./InputEdit";
import "./Sash";
import "./Memo";
import "./Table";
import "./table/Column";
import "./table/ColumnKey";
import "./table/ColumnNotNull";
import "./table/ColumnDataType";
import "./table/ColumnDataTypeHint";
import "./Minimap";
import "./minimap/MinimapHandle";
import "./minimap/Table";
import "./minimap/Column";
import "./minimap/Memo";
import "./DragSelect";
import "./Menubar";
import "./Visualization";
import "./visualization/Table";
import "./visualization/Column";

@customElement("vuerd-editor")
class Editor extends LitElement {
  static get styles() {
    return Layout;
  }

  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

  context: EditorContext;

  private subscriptionList: Subscription[] = [];

  constructor() {
    super();
    Logger.debug("Editor constructor");
    this.context = createEditorContext();
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug("Editor before render");
    const { store, keymap } = this.context;
    const { keydown$ } = this.context.windowEventObservable;
    this.subscriptionList.push.apply(this.subscriptionList, [
      store.observe(store.canvasState, name => {
        if (name === "canvasType") {
          this.requestUpdate();
        }
      }),
      keydown$.subscribe(event => {
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
            Logger.debug("keymap.stop");
            store.dispatch(selectEndTable(), selectEndMemo());
          }
        }
      }),
    ]);
  }
  firstUpdated() {
    Logger.debug("Editor after render");
    const span = this.renderRoot.querySelector(
      ".vuerd-text-width"
    ) as HTMLSpanElement;
    this.context.helper.setSpan(span);
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "width":
          Logger.debug(`width: ${this.width}`);
          break;
        case "height":
          Logger.debug(`height: ${this.height}`);
          break;
      }
    });
  }
  disconnectedCallback() {
    Logger.debug("Editor destroy");
    this.context.store.destroy();
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    Logger.debug("Editor render");
    const { canvasType } = this.context.store.canvasState;
    const {
      canvas,
      table,
      tableActive,
      focus,
      keyPK,
      keyFK,
      keyPFK,
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
      code,
      dragSelect,
      menubar,
      visualization,
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
          --vuerd-color-code: ${code};
          --vuerd-color-drag-select: ${dragSelect};
          --vuerd-color-menubar: ${menubar};
          --vuerd-color-visualization: ${visualization};
        }
      </style>
      <div
        class="vuerd-editor"
        style=${styleMap({
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
      >
        <vuerd-menubar></vuerd-menubar>
        ${canvasType === "ERD"
          ? html`
              <vuerd-erd
                .width=${this.width}
                .height=${this.height}
              ></vuerd-erd>
            `
          : canvasType === "Visualization"
          ? html`
              <vuerd-visualization .width=${this.width}></vuerd-visualization>
            `
          : ""}
        <span class="vuerd-text-width"></span>
      </div>
    `;
  }

  focus() {
    this.context.store.editorState.focus = true;
  }
  blur() {
    this.context.store.editorState.focus = false;
  }
  subscribe(effect: (commands: Command[]) => void): Subscription {
    const { store } = this.context;
    return store.subscribe(effect);
  }
  next(commands: Command[]) {
    const { store } = this.context;
    store.next(commands);
  }
}

@customElement("erd-editor")
class EditorAlias extends Editor {}
