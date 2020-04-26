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
import { drawEndRelationship } from "@src/core/command/editor";
import "./Icon";
import "./Contextmenu";
import "./InputEdit";
import "./Sash";
import "./Menubar";
import "./ERD";
import "./Visualization";
import "./SQL";
import "./GeneratorCode";

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
    this.context = createEditorContext();
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, keymap } = this.context;
    const { keydown$ } = this.context.windowEventObservable;
    this.subscriptionList.push(
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
            store.dispatch(
              selectEndTable(),
              selectEndMemo(),
              drawEndRelationship()
            );
          }
        }
      })
    );
  }
  firstUpdated() {
    const span = this.renderRoot.querySelector(
      ".vuerd-text-width"
    ) as HTMLSpanElement;
    this.context.helper.setSpan(span);
  }
  disconnectedCallback() {
    const { store, windowEventObservable } = this.context;
    store.destroy();
    windowEventObservable.destroy();
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
          : canvasType === "SQL"
          ? html`<vuerd-sql></vuerd-sql>`
          : canvasType === "GeneratorCode"
          ? html`<vuerd-generator-code></vuerd-generator-code>`
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
