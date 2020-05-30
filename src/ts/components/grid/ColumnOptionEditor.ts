import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { SimpleOption } from "@src/core/Grid";
import { moveKeys } from "@src/core/Keymap";

interface Option {
  name: string;
  simpleOption: SimpleOption;
  checked: boolean;
  active: boolean;
}

@customElement("vuerd-grid-column-option-editor")
export class ColumnOptionEditor extends EditorElement {
  private options: Option[] = [
    {
      name: "Primary Key",
      simpleOption: "PK",
      checked: false,
      active: true,
    },
    {
      name: "Not Null",
      simpleOption: "NN",
      checked: false,
      active: false,
    },
    {
      name: "Unique",
      simpleOption: "UQ",
      checked: false,
      active: false,
    },
    {
      name: "Auto Increment",
      simpleOption: "AI",
      checked: false,
      active: false,
    },
  ];

  get index() {
    let index = 0;
    this.options.forEach((option, i) => {
      if (option.active) {
        index = i;
      }
    });
    return index;
  }

  get value() {
    return this.options
      .filter((option) => option.checked)
      .map((option) => option.simpleOption)
      .join(",");
  }
  set value(simpleString: string) {
    simpleString.split(",").forEach((simple) => {
      const option = this.options.find(
        (option) => option.simpleOption === simple
      );
      if (option) {
        option.checked = true;
      }
    });
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
  }
  firstUpdated() {
    this.onActive(0);
  }
  updated() {
    this.onFocus();
  }

  render() {
    return html`
      <ul class="vuerd-grid-column-option-editor" @keydown=${this.onKeydown}>
        ${this.options.map(
          (option, index) => html`
            <li
              class=${classMap({
                active: option.active,
              })}
              @click=${() => this.onChecked(option.simpleOption)}
              @mouseover=${() => this.onActive(index)}
            >
              <input
                type="checkbox"
                ?checked=${option.checked}
                @change=${(event: Event) =>
                  this.onChange(event, option.simpleOption)}
              />
              <span>${option.name}</span>
            </li>
          `
        )}
      </ul>
    `;
  }

  private onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest(".vuerd-grid-column-option-editor")) {
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

  private onChecked(simpleOption: SimpleOption) {
    this.options.forEach((option) => {
      if (option.simpleOption === simpleOption) {
        option.checked = !option.checked;
      }
    });
    this.requestUpdate();
  }
  private onChange(event: Event, simpleOption: SimpleOption) {
    const el = event.target as HTMLInputElement;
    this.options.forEach((option) => {
      if (option.simpleOption === simpleOption) {
        option.checked = el.checked;
      }
    });
    this.requestUpdate();
  }
  private onKeydown(event: KeyboardEvent) {
    if (moveKeys.some((moveKey) => moveKey === event.key)) {
      event.preventDefault();
      const move =
        event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
      let index = this.index + move;
      if (index < 0) {
        index = this.options.length - 1;
      } else if (index > this.options.length - 1) {
        index = 0;
      }
      this.onActive(index);
    }
  }
  private onActive(index: number) {
    this.options.forEach((option, i) => {
      option.active = i === index;
    });
    this.requestUpdate();
  }
  private onFocus() {
    const input = this.renderRoot.querySelectorAll("input")[
      this.index
    ] as HTMLInputElement | null;
    input?.focus();
  }
}
