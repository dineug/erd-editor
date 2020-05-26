import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import {
  resizeCanvas,
  changeDatabaseName,
  changeCanvasType,
} from "@src/core/command/canvas";
import {
  filterActive,
  filterActiveEnd,
  findActive,
  findActiveEnd,
} from "@src/core/command/editor";
import { CanvasType } from "@src/core/store/Canvas";
import { keymapOptionToString } from "@src/core/Keymap";
import { SIZE_CANVAS_MIN, SIZE_CANVAS_MAX } from "@src/core/Layout";
import { Bus } from "@src/core/Event";

interface Menu {
  title: string;
  canvasType: CanvasType;
  prefix: string;
  icon: string;
  size: number;
}

const menus: Menu[] = [
  {
    title: "ERD",
    canvasType: "ERD",
    prefix: "fas",
    icon: "project-diagram",
    size: 18,
  },
  {
    title: "Grid",
    canvasType: "Grid",
    prefix: "fas",
    icon: "list",
    size: 18,
  },
  {
    title: "Visualization",
    canvasType: "Visualization",
    prefix: "mdi",
    icon: "chart-bubble",
    size: 24,
  },
  {
    title: "SQL DDL",
    canvasType: "SQL",
    prefix: "fas",
    icon: "code",
    size: 18,
  },
  {
    title: "Generator Code",
    canvasType: "GeneratorCode",
    prefix: "fas",
    icon: "sliders-h",
    size: 18,
  },
];

@customElement("vuerd-menubar")
class Menubar extends EditorElement {
  connectedCallback() {
    super.connectedCallback();
    const { store, eventBus } = this.context;
    this.subscriptionList.push(
      store.observe(store.editorState.filterStateList, () =>
        this.requestUpdate()
      ),
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "databaseName":
          case "width":
          case "height":
          case "canvasType":
            this.requestUpdate();
            break;
        }
      }),
      store.observe(store.editorState, (name) => {
        switch (name) {
          case "filterActive":
          case "findActive":
          case "hasUndo":
          case "hasRedo":
            this.requestUpdate();
            break;
        }
      })
    );
    eventBus.on(Bus.Menubar.filter, this.onFilter);
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.Menubar.filter, this.onFilter);
    super.disconnectedCallback();
  }

  render() {
    const { keymap } = this.context;
    const {
      filterActive,
      filterStateList,
      findActive,
      hasUndo,
      hasRedo,
    } = this.context.store.editorState;
    const { databaseName, width, canvasType } = this.context.store.canvasState;
    return html`
      <ul class="vuerd-menubar" @mousedown=${this.onMousedown}>
        <li class="vuerd-menubar-input">
          <input
            style="width: 200px;"
            type="text"
            title="database name"
            placeholder="database name"
            spellcheck="false"
            .value=${databaseName}
            @input=${this.onChangeDatabaseName}
          />
        </li>
        <li class="vuerd-menubar-input">
          <input
            style="width: 65px;"
            type="text"
            title="canvas size"
            spellcheck="false"
            placeholder="canvas size"
            .value=${width.toString()}
            @input=${this.onResizeValid}
            @change=${this.onResizeCanvas}
          />
        </li>
        ${menus.map(
          (menu) => html`
            <li
              class=${classMap({
                "vuerd-menubar-menu": true,
                active: canvasType === menu.canvasType,
              })}
              title=${menu.title}
              @click=${() => this.onChangeCanvasType(menu.canvasType)}
            >
              <vuerd-icon
                .prefix=${menu.prefix}
                .icon=${menu.icon}
                .size=${menu.size}
              ></vuerd-icon>
            </li>
          `
        )}
        <li class="vuerd-menubar-menu" title="Help" @click=${this.onHelp}>
          <vuerd-icon icon="question" size="16"></vuerd-icon>
        </li>
        ${canvasType === "ERD"
          ? html`
              <li
                class="vuerd-menubar-menu"
                title=${`Find ${keymapOptionToString(keymap.find[0])}`}
                @click=${this.onFind}
              >
                <vuerd-icon icon="search" size="16"></vuerd-icon>
              </li>
              <li
                class=${classMap({
                  "vuerd-menubar-menu": true,
                  "undo-redo": true,
                  active: hasUndo,
                })}
                title=${`Undo ${keymapOptionToString(keymap.undo[0])}`}
                @click=${this.onUndo}
              >
                <vuerd-icon icon="undo-alt" size="16"></vuerd-icon>
              </li>
              <li
                class=${classMap({
                  "vuerd-menubar-menu": true,
                  "undo-redo": true,
                  active: hasRedo,
                })}
                title=${`Redo ${keymapOptionToString(keymap.redo[0])}`}
                @click=${this.onRedo}
              >
                <vuerd-icon icon="redo-alt" size="16"></vuerd-icon>
              </li>
            `
          : ""}
        ${canvasType === "Grid"
          ? html`
              <li
                class=${classMap({
                  "vuerd-menubar-menu": true,
                  active: filterStateList.length !== 0,
                })}
                title=${`Filter ${keymapOptionToString(keymap.find[0])}`}
                @click=${this.onFilter}
              >
                <vuerd-icon icon="filter" size="16"></vuerd-icon>
              </li>
            `
          : ""}
      </ul>
      ${findActive
        ? html`<vuerd-find @close=${this.onFindEnd}></vuerd-find>`
        : ""}
      ${filterActive
        ? html`
            <vuerd-grid-filter @close=${this.onFilterEnd}></vuerd-grid-filter>
          `
        : ""}
    `;
  }

  private onFilter = () => {
    const { store } = this.context;
    store.dispatch(filterActive());
  };
  private onFind = () => {
    const { store } = this.context;
    store.dispatch(findActive());
  };

  private onFilterEnd() {
    const { store } = this.context;
    store.dispatch(filterActiveEnd());
  }
  private onFindEnd() {
    const { store } = this.context;
    store.dispatch(findActiveEnd());
  }
  private onMousedown(event: MouseEvent) {
    const { eventBus } = this.context;
    eventBus.emit(Bus.ERD.contextmenuEnd);
  }
  private onChangeDatabaseName(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    const { store } = this.context;
    store.dispatch(changeDatabaseName(input.value));
  }
  private onResizeValid(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, "");
  }
  private onResizeCanvas(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    let size = Number(input.value.replace(/[^0-9]/g, ""));
    if (size < SIZE_CANVAS_MIN) {
      size = SIZE_CANVAS_MIN;
    } else if (size > SIZE_CANVAS_MAX) {
      size = SIZE_CANVAS_MAX;
    }
    input.value = size.toString();
    const { store } = this.context;
    store.dispatch(resizeCanvas(size, size));
  }
  private onChangeCanvasType(canvasType: CanvasType) {
    const { store } = this.context;
    if (canvasType !== store.canvasState.canvasType) {
      store.dispatch(changeCanvasType(canvasType));
    }
  }
  private onHelp() {
    this.dispatchEvent(new CustomEvent("help-start"));
  }
  private onUndo() {
    const { store } = this.context;
    store.undo();
  }
  private onRedo() {
    const { store } = this.context;
    store.redo();
  }
}
