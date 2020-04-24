import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { Subscription } from "rxjs";
import { EditorElement } from "./EditorElement";
import { Logger } from "@src/core/Logger";
import {
  resizeCanvas,
  changeDatabaseName,
  changeCanvasType,
} from "@src/core/command/canvas";
import { CanvasType } from "@src/core/store/Canvas";
import { SIZE_CANVAS_MIN, SIZE_CANVAS_MAX } from "@src/core/Layout";
import { Bus } from "@src/core/Event";

@customElement("vuerd-menubar")
class Menubar extends EditorElement {
  private subscriptionList: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.subscriptionList.push(
      store.observe(store.canvasState, (name) => {
        Logger.debug(name);
        switch (name) {
          case "databaseName":
          case "width":
          case "height":
          case "canvasType":
            this.requestUpdate();
            break;
        }
      })
    );
  }
  disconnectedCallback() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
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
        <li
          class=${classMap({
            "vuerd-menubar-menu": true,
            active: canvasType === "ERD",
          })}
          title="ERD"
          @click=${() => this.onChangeCanvasType("ERD")}
        >
          <vuerd-icon icon="project-diagram" size="18"></vuerd-icon>
        </li>
        <li
          class=${classMap({
            "vuerd-menubar-menu": true,
            active: canvasType === "Visualization",
          })}
          title="Visualization"
          @click=${() => this.onChangeCanvasType("Visualization")}
        >
          <vuerd-icon prefix="mdi" icon="chart-bubble"></vuerd-icon>
        </li>
      </ul>
    `;
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
}
