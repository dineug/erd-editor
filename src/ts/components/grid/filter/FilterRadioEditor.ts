import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { moveKeys } from "@src/core/Keymap";

export interface RadioItem {
  name: string;
  value: string;
}

@customElement("vuerd-grid-filter-radio-editor")
class FilterRadioEditor extends EditorElement {
  @property({ type: Number })
  width = 100;
  @property({ type: Boolean })
  edit = false;
  @property({ type: Boolean })
  focusState = false;
  @property({ type: Boolean })
  select = false;
  @property({ type: String })
  value = "";
  @property({ type: String })
  placeholder = "";
  @property({ type: Number })
  activeIndex = 0;

  items: RadioItem[] = [];

  private subKeydown: Subscription | null = null;

  get placeholderValue() {
    if (this.value.trim() === "") {
      return this.placeholder;
    }
    return this.value;
  }

  connectedCallback() {
    super.connectedCallback();
    const { mousedown$ } = this.context.windowEventObservable;
    const root = this.getRootNode() as ShadowRoot;
    const editor = root.querySelector(".vuerd-editor") as Element;
    this.subscriptionList.push(
      mousedown$.subscribe(this.onMousedownWindow),
      fromEvent<MouseEvent>(editor, "mousedown").subscribe(this.onMousedown)
    );
    this.items.forEach((item, i) => {
      if (item.value === this.value) {
        this.activeIndex = i;
      }
    });
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "edit":
          if (this.edit) {
            const { keydown$ } = this.context.windowEventObservable;
            this.subKeydown?.unsubscribe();
            this.subKeydown = keydown$.subscribe(this.onKeydown);
          } else {
            this.subKeydown?.unsubscribe();
          }
          break;
      }
    });
  }
  disconnectedCallback() {
    this.subKeydown?.unsubscribe();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div
        class=${classMap({
          "vuerd-grid-filter-radio-editor": true,
          placeholder: this.value.trim() === "" && !this.edit,
          focus: this.focusState && !this.edit,
          edit: this.edit,
          select: this.select,
        })}
        style=${styleMap({
          width: `${this.width}px`,
        })}
      >
        <span>${this.placeholderValue}</span>
        ${this.edit
          ? html`
              <ul class="vuerd-grid-filter-radio-editor-box">
                ${this.items.map(
                  (item, index) =>
                    html`
                      <li
                        class=${classMap({
                          active: this.activeIndex === index,
                        })}
                        @click=${() => this.onClick(item)}
                        @mouseover=${() => this.onActiveIndex(index)}
                      >
                        ${this.value === item.value
                          ? html`
                              <span class="icon">
                                <vuerd-icon icon="check" size="12"></vuerd-icon>
                              </span>
                            `
                          : html`<span class="icon"></span>`}
                        <span>${item.name}</span>
                      </li>
                    `
                )}
              </ul>
            `
          : ""}
      </div>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-grid-filter-radio-editor")) {
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
  private onKeydown = (event: KeyboardEvent) => {
    if (moveKeys.some((moveKey) => moveKey === event.key)) {
      event.preventDefault();
      const move =
        event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
      let index = this.activeIndex + move;
      if (index < 0) {
        index = this.items.length - 1;
      } else if (index > this.items.length - 1) {
        index = 0;
      }
      this.onActiveIndex(index);
    } else if (event.code === "Space") {
      this.onClick(this.items[this.activeIndex]);
    }
  };

  private onClick(item: RadioItem) {
    if (this.value !== item.value) {
      this.value = item.value;
      this.dispatchEvent(
        new CustomEvent("change", {
          detail: {
            value: item.value,
          },
        })
      );
    }
  }
  private onActiveIndex(index: number) {
    this.activeIndex = index;
  }
}
