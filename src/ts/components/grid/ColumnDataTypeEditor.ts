import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { databaseHints, DataTypeHint } from "@src/core/DataType";
import { markToHTML } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";

interface Hint {
  name: string;
  html: string;
  active: boolean;
}

@customElement("vuerd-grid-column-data-type-editor")
export class ColumnDataTypeEditor extends EditorElement {
  @property({ type: String })
  value = "";
  @property({ type: Array })
  hints: Hint[] = [];

  private startFilter = true;
  private subscriptionList: Subscription[] = [];
  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-grid-data-type-hint",
    "vuerd-grid-data-type-hint-move"
  );

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
  disconnectedCallback() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="vuerd-grid-column-data-type-editor">
        <input
          class="vuerd-input-grid"
          type="text"
          spellcheck="false"
          .value=${this.value}
          @keydown=${this.onKeydown}
          @input=${this.onInput}
        />
        <ul class="vuerd-grid-column-data-type-hint">
          ${repeat(
            this.hints,
            (hint) => hint.name,
            (hint) => {
              return html`
                <li
                  class=${classMap({
                    "vuerd-grid-data-type-hint": true,
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
    if (!el.closest(".vuerd-grid-column-data-type-editor")) {
      this.dispatchEvent(new Event("blur"));
    }
  };
  private onMousedownWindow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    const root = this.getRootNode() as ShadowRoot;
    if (!el.closest(root.host.localName)) {
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
    const index = this.activeIndex;
    if (index !== null) {
      event.preventDefault();
      this.startFilter = false;
      this.value = this.hints[index].name;
    }
  }
  private onStartFilter() {
    this.startFilter = true;
  }

  private onSelectHint(hint: Hint) {
    this.startFilter = false;
    this.activeEnd();
    this.value = hint.name;
    const input = this.renderRoot.querySelector("input");
    if (input) {
      const len = input.value.length;
      input.selectionStart = len;
      input.selectionEnd = len;
      input.focus();
    }
  }

  private hintFilter() {
    if (this.startFilter) {
      if (this.value.trim() === "") {
        this.hints = this.dataTypeHints.map((dataTypeHint) => {
          return {
            name: dataTypeHint.name,
            html: dataTypeHint.name,
            active: false,
          };
        });
      } else {
        this.hints = this.dataTypeHints
          .filter(
            (dataTypeHint) =>
              dataTypeHint.name
                .toLowerCase()
                .indexOf(this.value.toLowerCase()) !== -1
          )
          .map((dataTypeHint) => {
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
    this.hints.forEach((hint) => (hint.active = false));
  }
}
