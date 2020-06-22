import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { markToHTML, getData } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";
import { Table } from "@src/core/store/Table";
import { addIndexColumn } from "@src/core/command/indexes";

interface Hint {
  id: string;
  name: string;
  html: string;
  active: boolean;
}

@customElement("vuerd-index-add-column")
class IndexAddColumn extends EditorElement {
  @property({ type: String })
  value = "";
  @property({ type: Array })
  hints: Hint[] = [];

  table!: Table;
  indexId!: string;

  private startFilter = true;
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-index-add-column-hint",
    "vuerd-index-add-column-hint-move"
  );

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
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.hintFilter();
    this.subscriptionList.push(
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown)
    );
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "value":
          this.flipAnimation.snapshot();
          this.hintFilter();
          break;
        case "hints":
          this.flipAnimation.play();
          break;
      }
    });
  }

  render() {
    return html`
      <div class="vuerd-index-add-column">
        <input
          style="width: 80px;"
          type="text"
          placeholder="add column"
          spellcheck="false"
          @keydown=${this.onKeydown}
          @input=${this.onInput}
          @focus=${this.onFocus}
        />
        <ul class="vuerd-index-add-column-list">
          ${repeat(
            this.hints,
            (hint) => hint.name,
            (hint) => {
              return html`
                <li
                  class=${classMap({
                    "vuerd-index-add-column-hint": true,
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
      </div>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-index-add-column")) {
      this.hints = [];
    }
  };

  private onFocus() {
    this.hintFilter();
  }
  private onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.onStartFilter();
  }
  private onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowUp":
        this.onArrowUp(event);
        break;
      case "ArrowDown":
        this.onArrowDown(event);
        break;
      case "ArrowLeft":
        this.onArrowLeft(event);
        break;
      case "Enter":
      case "ArrowRight":
        this.onArrowRight(event);
        break;
    }
  }
  private onArrowUp(event: KeyboardEvent) {
    if (this.hints.length !== 0) {
      event.preventDefault();
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
  }
  private onArrowDown(event: KeyboardEvent) {
    if (this.hints.length !== 0) {
      event.preventDefault();
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
  }
  private onArrowLeft(event: KeyboardEvent) {
    this.activeEnd();
    this.requestUpdate();
  }
  private onArrowRight(event: KeyboardEvent) {
    const { store } = this.context;
    const { indexes } = store.tableState;
    const columns = this.table.columns;
    const index = this.activeIndex;
    if (index !== null) {
      event.preventDefault();
      this.startFilter = false;
      const indexModel = getData(indexes, this.indexId);
      const targetColumn = getData(columns, this.hints[index].id);
      if (
        targetColumn &&
        indexModel &&
        !indexModel.columns.some((column) => column.id === targetColumn.id)
      ) {
        store.dispatch(addIndexColumn(this.indexId, targetColumn.id));
      }
    }
  }
  private onStartFilter() {
    this.startFilter = true;
  }

  private onSelectHint(hint: Hint) {
    const { store } = this.context;
    const { indexes } = store.tableState;
    const columns = this.table.columns;
    this.startFilter = false;
    this.activeEnd();
    const input = this.renderRoot.querySelector("input");
    if (input) {
      const len = input.value.length;
      input.selectionStart = len;
      input.selectionEnd = len;
      input.focus();
    }
    const indexModel = getData(indexes, this.indexId);
    const targetColumn = getData(columns, hint.id);
    if (
      targetColumn &&
      indexModel &&
      !indexModel.columns.some((column) => column.id === targetColumn.id)
    ) {
      store.dispatch(addIndexColumn(this.indexId, targetColumn.id));
    }
  }

  private hintFilter() {
    const columns = this.table.columns;
    if (this.startFilter) {
      if (this.value.trim().length < 1) {
        this.hints = [];
      } else {
        this.hints = columns
          .filter(
            (column) =>
              column.name.toLowerCase().indexOf(this.value.toLowerCase()) !== -1
          )
          .map((column) => {
            return {
              id: column.id,
              name: column.name,
              html: markToHTML("vuerd-mark", column.name, this.value),
              active: false,
            };
          });
      }
    }
  }
  private activeEnd() {
    this.hints.forEach((hint) => (hint.active = false));
  }
}
