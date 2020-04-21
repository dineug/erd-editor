import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Layout, defaultWidth, defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { keymapMatch } from "@src/core/Keymap";
import { createEditorContext } from "@src/core/EditorContext";
import { Command } from "@src/core/Command";
import { selectEndTable } from "@src/core/command/table";
import { selectEndMemo } from "@src/core/command/memo";
import "./ERD";
import "./Canvas";
import "./CanvasSVG";
import "./Fontawesome";
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

@customElement("vuerd-editor")
class Editor extends EditorElement {
  static get styles() {
    return Layout;
  }

  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

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
    this.subscriptionList.push(
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
      })
    );
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

  protected createRenderRoot(): Element | ShadowRoot {
    return this.attachShadow({ mode: "open" });
  }

  render() {
    Logger.debug("Editor render");
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
        }
      </style>
      <div
        class="vuerd-editor"
        style=${styleMap({
          width: `${this.width}px`,
          height: `${this.height}px`,
        })}
      >
        <vuerd-erd
          .context=${this.context}
          .width=${this.width}
          .height=${this.height}
        ></vuerd-erd>
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
