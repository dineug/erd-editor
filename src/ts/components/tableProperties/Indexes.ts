import { html, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { getData } from "@src/core/Helper";
import { Table, Column } from "@src/core/store/Table";
import {
  addIndex,
  removeIndex,
  changeIndexName,
} from "@src/core/command/indexes";

interface Index {
  id: string;
  name: string;
  columns: Column[];
}

@customElement("vuerd-indexes")
class Indexes extends EditorElement {
  table!: Table;

  get indexes(): Index[] {
    const { indexes } = this.context.store.tableState;
    return indexes
      .filter((index) => index.tableId === this.table.id)
      .map((index) => {
        return {
          id: index.id,
          name: index.name,
          columns: index.columnIds
            .map((columnId) => getData(this.table.columns, columnId))
            .filter((column) => column !== null) as Column[],
        };
      });
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { indexes } = store.tableState;
    store.observe(indexes, () => this.requestUpdate());
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
              <div class="vuerd-index-add-column">
                <input
                  type="text"
                  placeholder="add column"
                  spellcheck="false"
                />
                <ul class="vuerd-index-add-column-list">
                  <li class="vuerd-index-add-column-hint">123</li>
                  <li class="vuerd-index-add-column-hint">456</li>
                  <li class="vuerd-index-add-column-hint">789</li>
                </ul>
              </div>
              ${repeat(
                index.columns,
                (column) => column.id,
                (column) => html`
                  <span class="vuerd-index-column">
                    <span class="vuerd-index-column-name">
                      ${column.name}
                    </span>
                    <vuerd-icon
                      class="vuerd-button"
                      title="remove column"
                      icon="times"
                      size="9"
                    ></vuerd-icon>
                  </span>
                `
              )}
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
