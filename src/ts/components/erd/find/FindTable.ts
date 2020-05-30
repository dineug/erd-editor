import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { markToHTML } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";
import { SIZE_START_X, SIZE_START_Y } from "@src/core/Layout";
import { Table } from "@src/core/store/Table";
import { moveCanvas } from "@src/core/command/canvas";
import { selectOnlyTable } from "@src/core/command/table";

interface Hint {
  name: string;
  html: string;
  active: boolean;
}

@customElement("vuerd-find-table")
class FindTable extends EditorElement {
  @property({ type: String })
  value = "";
  @property({ type: Array })
  hints: Hint[] = [];

  private startFilter = true;
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-find-table-hint",
    "vuerd-find-table-hint-move"
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
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.hintFilter();
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown)
    );
  }
  firstUpdated() {
    const input = this.renderRoot.querySelector("input");
    input?.focus();
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
      <div class="vuerd-find-table">
        <input
          type="text"
          spellcheck="false"
          .value=${this.value}
          placeholder="table"
          @keydown=${this.onKeydown}
          @input=${this.onInput}
        />
        <ul class="vuerd-find-table-list">
          ${repeat(
            this.hints,
            (hint) => hint.name,
            (hint) => {
              return html`
                <li
                  class=${classMap({
                    "vuerd-find-table-hint": true,
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
    if (!el.closest(".vuerd-find-table")) {
      this.dispatchEvent(new Event("blur"));
    }
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const { user } = this.context.store;
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    const target = el.closest(root.host.localName) as any;
    if (!target || user.id !== target?.context?.store?.user?.id) {
      this.dispatchEvent(new Event("blur"));
    }
  };

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
    const { tables } = this.context.store.tableState;
    const index = this.activeIndex;
    if (index !== null) {
      event.preventDefault();
      this.startFilter = false;
      const table = tables.find(
        (table) => table.name === this.hints[index].name
      );
      if (table) {
        this.moveCanvasFindTable(table);
      }
    }
  }
  private onStartFilter() {
    this.startFilter = true;
  }

  private onSelectHint(hint: Hint) {
    const { tables } = this.context.store.tableState;
    this.startFilter = false;
    this.activeEnd();
    const input = this.renderRoot.querySelector("input");
    if (input) {
      const len = input.value.length;
      input.selectionStart = len;
      input.selectionEnd = len;
      input.focus();
    }
    const table = tables.find((table) => table.name === hint.name);
    if (table) {
      this.moveCanvasFindTable(table);
    }
  }

  private hintFilter() {
    const { tables } = this.context.store.tableState;
    if (this.startFilter) {
      if (this.value.trim().length < 1) {
        this.hints = [];
      } else {
        this.hints = tables
          .filter(
            (table) =>
              table.name.toLowerCase().indexOf(this.value.toLowerCase()) !== -1
          )
          .map((table) => {
            return {
              name: table.name,
              html: markToHTML("vuerd-mark", table.name, this.value),
              active: false,
            };
          });
      }
    }
  }
  private activeEnd() {
    this.hints.forEach((hint) => (hint.active = false));
  }
  private moveCanvasFindTable(table: Table) {
    const { store } = this.context;
    store.dispatch(
      moveCanvas(table.ui.top - SIZE_START_Y, table.ui.left - SIZE_START_X),
      selectOnlyTable(store, table.id)
    );
  }
}
