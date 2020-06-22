import { html, customElement } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Table, Index } from "@src/core/store/Table";
import {
  addIndex,
  removeIndex,
  changeIndexName,
  changeIndexUnique,
} from "@src/core/command/indexes";

@customElement("vuerd-tab-indexes")
class TabIndexes extends EditorElement {
  table!: Table;

  private subIndexes: Subscription[] = [];

  get indexes(): Index[] {
    const { indexes } = this.context.store.tableState;
    return indexes.filter((index) => index.tableId === this.table.id);
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { indexes } = store.tableState;
    this.subscriptionList.push(
      store.observe(indexes, () => {
        this.unsubscribeIndex();
        this.subscribeIndex();
        this.requestUpdate();
      })
    );
    this.subscribeIndex();
  }
  disconnectedCallback() {
    this.unsubscribeIndex();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="vuerd-tab-indexes">
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
                @click=${() => this.onRemoveIndex(index)}
              ></vuerd-icon>
              <div
                class=${classMap({
                  "vuerd-index-unique": true,
                  checked: index.unique,
                })}
                style="width: 22px;"
                title="Unique"
                @click=${() => this.onChangeIndexUnique(index)}
              >
                UQ
              </div>
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
  private onRemoveIndex(index: Index) {
    const { store } = this.context;
    store.dispatch(removeIndex([index.id]));
  }
  private onChangeIndexUnique(index: Index) {
    const { store } = this.context;
    store.dispatch(changeIndexUnique(index.id, !index.unique));
  }
  private onInput(event: InputEvent, index: Index) {
    const { store } = this.context;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeIndexName(index.id, input.value));
  }

  private subscribeIndex() {
    const { store } = this.context;
    const { indexes } = this.context.store.tableState;
    indexes.forEach((index) => {
      this.subIndexes.push(
        store.observe(index, (name) => {
          if (name === "unique") {
            this.requestUpdate();
          }
        })
      );
    });
  }
  private unsubscribeIndex() {
    this.subIndexes.forEach((sub) => sub.unsubscribe());
    this.subIndexes = [];
  }
}
