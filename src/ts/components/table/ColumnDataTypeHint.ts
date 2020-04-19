import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { Subscription } from "rxjs";
import { fromEvent, Observable } from "rxjs";
import { EditorElement } from "../EditorElement";
import { Logger } from "@src/core/Logger";
import { databaseHints, DataTypeHint } from "@src/core/DataType";
import { markToHTML } from "@src/core/Helper";
import { useTransitionFlip } from "@src/core/Animation";
import { Bus } from "@src/core/Event";
import { changeColumnDataType } from "@src/core/command/column";

interface Hint {
  name: string;
  html: string;
  active: boolean;
}

@customElement("vuerd-column-data-type-hint")
class ColumnDataTypeHint extends EditorElement {
  @property({ type: String })
  value = "";
  @property({ type: Array })
  hints: Hint[] = [];

  tableId!: string;
  columnId!: string;

  private filterStart = true;
  private snapshotHint!: (list: HTMLElement[]) => void;
  private playHint!: (list: HTMLElement[], className: string) => void;
  private subscriptionList: Subscription[] = [];

  get dataTypeHints() {
    const { canvasState } = this.context.store;
    let dataTypeHints: DataTypeHint[] = [];
    for (const databaseHint of databaseHints) {
      if (databaseHint.database === canvasState.database) {
        dataTypeHints = databaseHint.dataTypeHints;
        break;
      }
    }
    return dataTypeHints;
  }

  get activeIndex(): number | null {
    let index: number | null = null;
    for (let i = 0; i < this.hints.length; i++) {
      if (this.hints[i].active) {
        index = i;
        break;
      }
    }
    return index;
  }

  connectedCallback() {
    super.connectedCallback();
    const { eventBus } = this.context;
    const { mousedown$ } = this.context.windowEventObservable;
    const { snapshot, play } = useTransitionFlip();
    const root = this.getRootNode() as Element | DocumentFragment;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.snapshotHint = snapshot;
    this.playHint = play;
    this.hintFilter();
    this.subscriptionList.push.apply(this.subscriptionList, [
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(
        this.onMousedownHost
      ),
      mousedown$.subscribe(this.onMousedown),
    ]);
    eventBus.on(Bus.ColumnDataTypeHint.arrowUp, this.onArrowUp);
    eventBus.on(Bus.ColumnDataTypeHint.arrowDown, this.onArrowDown);
    eventBus.on(Bus.ColumnDataTypeHint.arrowLeft, this.onArrowLeft);
    eventBus.on(Bus.ColumnDataTypeHint.arrowRight, this.onArrowRight);
    eventBus.on(Bus.ColumnDataTypeHint.filterStart, this.onFilterStart);
  }
  updated(changedProperties: any) {
    Logger.debug("ColumnDataTypeHint updated");
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "value":
          this.snapshotHint(
            Array.from(
              this.renderRoot.querySelectorAll(".vuerd-data-type-hint")
            ) as HTMLElement[]
          );
          this.hintFilter();
          break;
        case "hints":
          this.playHint(
            Array.from(
              this.renderRoot.querySelectorAll(".vuerd-data-type-hint")
            ) as HTMLElement[],
            "vuerd-data-type-hint-move"
          );
          break;
      }
    });
  }
  disconnectedCallback() {
    const { eventBus } = this.context;
    eventBus.off(Bus.ColumnDataTypeHint.arrowUp, this.onArrowUp);
    eventBus.off(Bus.ColumnDataTypeHint.arrowDown, this.onArrowDown);
    eventBus.off(Bus.ColumnDataTypeHint.arrowLeft, this.onArrowLeft);
    eventBus.off(Bus.ColumnDataTypeHint.arrowRight, this.onArrowRight);
    eventBus.off(Bus.ColumnDataTypeHint.filterStart, this.onFilterStart);
    this.subscriptionList.forEach(sub => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <ul class="vuerd-column-data-type-hint">
        ${repeat(
          this.hints,
          hint => hint.name,
          hint => {
            return html`
              <li
                class=${classMap({
                  "vuerd-data-type-hint": true,
                  active: hint.active,
                })}
                @click=${() => this.onSelectHint(hint)}
              >
                ${unsafeHTML(hint.html)}
              </li>
            `;
          }
        )}
      </ul>
    `;
  }

  private onArrowUp = (event: CustomEvent) => {
    Logger.debug("ColumnDataTypeHint onArrowUp");
    if (this.hints.length !== 0) {
      event.detail.preventDefault();
    }
    const index = this.activeIndex;
    if (index !== null && index !== 0) {
      this.hints[index].active = false;
      this.hints[index - 1].active = true;
      this.requestUpdate();
    } else if (this.hints.length !== 0) {
      if (index === 0) {
        this.hints[index].active = false;
      }
      this.hints[this.hints.length - 1].active = true;
      this.requestUpdate();
    }
  };
  private onArrowDown = (event: CustomEvent) => {
    Logger.debug("ColumnDataTypeHint onArrowDown");
    if (this.hints.length !== 0) {
      event.detail.preventDefault();
    }
    const index = this.activeIndex;
    if (index !== null && index !== this.hints.length - 1) {
      this.hints[index].active = false;
      this.hints[index + 1].active = true;
      this.requestUpdate();
    } else if (this.hints.length !== 0) {
      if (index === this.hints.length - 1) {
        this.hints[index].active = false;
      }
      this.hints[0].active = true;
      this.requestUpdate();
    }
  };
  private onArrowLeft = (event: CustomEvent) => {
    Logger.debug("ColumnDataTypeHint onArrowLeft");
    this.activeEnd();
    this.requestUpdate();
  };
  private onArrowRight = (event: CustomEvent) => {
    Logger.debug("ColumnDataTypeHint onArrowRight");
    const index = this.activeIndex;
    if (index !== null) {
      event.detail.preventDefault();
      this.filterStart = false;
      const { store, helper } = this.context;
      store.dispatch(
        changeColumnDataType(
          helper,
          this.tableId,
          this.columnId,
          this.hints[index].name
        )
      );
    }
  };
  private onFilterStart = (event: CustomEvent) => {
    this.filterStart = true;
  };
  private onMousedownHost = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-column-data-type")) {
      this.dispatchEvent(new Event("blur"));
    }
  };
  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as any;
    if (!el.closest(root.host.localName)) {
      this.dispatchEvent(new Event("blur"));
    }
  };

  private onSelectHint(hint: Hint) {
    Logger.debug("ColumnDataTypeHint onSelectHint");
    this.filterStart = false;
    const { store, helper } = this.context;
    store.dispatch(
      changeColumnDataType(helper, this.tableId, this.columnId, hint.name)
    );
    this.activeEnd();
  }

  private hintFilter() {
    if (this.filterStart) {
      if (this.value.trim() === "") {
        this.hints = this.dataTypeHints.map(dataTypeHint => {
          return {
            name: dataTypeHint.name,
            html: dataTypeHint.name,
            active: false,
          };
        });
      } else {
        this.hints = this.dataTypeHints
          .filter(
            dataTypeHint =>
              dataTypeHint.name
                .toLowerCase()
                .indexOf(this.value.toLowerCase()) !== -1
          )
          .map(dataTypeHint => {
            return {
              name: dataTypeHint.name,
              html: markToHTML("vuerd-mark", dataTypeHint.name, this.value),
              active: false,
            };
          });
      }
    }
  }
  private activeEnd() {
    this.hints.forEach(hint => (hint.active = false));
  }
}
