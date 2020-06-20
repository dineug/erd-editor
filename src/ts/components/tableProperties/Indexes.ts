import { html, customElement } from "lit-element";
import { repeat } from "lit-html/directives/repeat";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Table, Index } from "@src/core/store/Table";
import {
  addIndex,
  removeIndex,
  changeIndexName,
} from "@src/core/command/indexes";

@customElement("vuerd-indexes")
class Indexes extends EditorElement {
  table!: Table;

  get indexes(): Index[] {
    const { indexes } = this.context.store.tableState;
    return indexes.filter((index) => index.tableId === this.table.id);
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { indexes } = store.tableState;
    this.subscriptionList.push(
      store.observe(indexes, () => this.requestUpdate())
    );
  }

  render() {
    return html`
      <div class="vuerd-indexes">
        <div>
          <vuerd-icon
            class="vuerd-button"
            title="New Index"
            icon="plus"
            size="12"
            @click=${this.onAddIndex}
          ></vuerd-icon>
        </div>
        ${repeat(
          this.indexes,
          (index) => index.id,
          (index) => html`
            <div class="vuerd-index">
              <vuerd-icon
                class="vuerd-button"
                title="remove index"
                icon="times"
                size="9"
                @click=${() => this.onRemoveIndex(index.id)}
              ></vuerd-icon>
              <input
                type="text"
                placeholder="index name"
                spellcheck="false"
                .value=${index.name}
                @input=${(event: InputEvent) => this.onInput(event, index)}
              />
              <vuerd-index-add-column
                .table=${this.table}
                .indexId=${index.id}
              ></vuerd-index-add-column>
              <vuerd-index-column
                .table=${this.table}
                .indexId=${index.id}
              ></vuerd-index-column>
            </div>
          `
        )}
      </div>
    `;
  }

  private onAddIndex() {
    const { store } = this.context;
    store.dispatch(addIndex(this.table.id));
  }
  private onRemoveIndex(indexId: string) {
    const { store } = this.context;
    store.dispatch(removeIndex([indexId]));
  }
  private onInput(event: InputEvent, index: Index) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeIndexName(index.id, input.value));
  }
}
