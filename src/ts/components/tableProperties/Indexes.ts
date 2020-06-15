import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Table } from "@src/core/store/Table";

@customElement("vuerd-indexes")
class Indexes extends EditorElement {
  table!: Table;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
  }

  render() {
    return html`
      <div class="vuerd-indexes">
        <input type="text" placeholder="index name" />
        <input type="text" placeholder="column" />
      </div>
    `;
  }
}
