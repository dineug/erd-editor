import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subject, fromEvent, Subscription } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { getData, cloneDeep } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";
import { Table, Column, Index, OrderType } from "@src/core/store/Table";
import {
  removeIndexColumn,
  moveIndexColumn,
  changeIndexColumnOrderType,
} from "@src/core/command/indexes";

interface IndexColumn extends Column {
  orderType: OrderType;
}

interface IndexModel {
  id: string;
  columns: IndexColumn[];
}

@customElement("vuerd-index-column")
class IndexColumn extends EditorElement {
  @property({ type: String })
  currentColumnId = "";

  table!: Table;
  indexId!: string;

  private flipAnimation = new FlipAnimation(
    this.renderRoot,
    ".vuerd-index-column",
    "vuerd-index-column-move"
  );
  private draggable$: Subject<string> = new Subject();
  private subDraggable: Subscription[] = [];
  private subColumns: Subscription[] = [];

  get index(): IndexModel {
    const { indexes } = this.context.store.tableState;
    const index = getData(indexes, this.indexId) as Index;
    return {
      id: index.id,
      columns: index.columns
        .map((column) => {
          const data = getData(this.table.columns, column.id);
          if (data) {
            const newData = cloneDeep(data) as IndexColumn;
            newData.orderType = column.orderType;
            return newData;
          }
          return null;
        })
        .filter((column) => column !== null) as IndexColumn[],
    };
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { indexes } = store.tableState;
    const index = getData(indexes, this.indexId);
    if (index) {
      this.subscriptionList.push(
        store.observe(index.columns, () => {
          this.unsubscribeColumn();
          this.subscribeColumn();
          this.requestUpdate();
        })
      );
      this.subscribeColumn();
    }
    this.subscriptionList.push(
      this.draggable$.pipe(debounceTime(50)).subscribe(this.onDragoverGroup)
    );
  }
  updated(changedProperties: any) {
    this.flipAnimation.play();
  }
  disconnectedCallback() {
    this.subDraggable.forEach((sub) => sub.unsubscribe);
    this.unsubscribeColumn();
    super.disconnectedCallback();
  }

  render() {
    return html`
      ${repeat(
        this.index.columns,
        (column) => column.id,
        (column) => html`
          <div
            class=${classMap({
              "vuerd-index-column": true,
              draggable: this.currentColumnId === column.id,
            })}
            data-id=${column.id}
            draggable="true"
            @dragstart=${this.onDragstart}
            @dragend=${this.onDragend}
          >
            <div class="vuerd-index-column-name">
              ${column.name}
            </div>
            <div
              class="vuerd-index-column-order"
              @click=${() => this.onChangeColumnOrderType(column)}
            >
              ${column.orderType}
            </div>
            <vuerd-icon
              class="vuerd-button"
              title="remove column"
              icon="times"
              size="9"
              @click=${() => this.onRemoveColumn(column)}
            ></vuerd-icon>
          </div>
        `
      )}
    `;
  }

  private onDragoverGroup = (columnId: string) => {
    const { store } = this.context;
    if (this.currentColumnId !== columnId) {
      this.flipAnimation.snapshot();
      store.dispatch(
        moveIndexColumn(this.indexId, this.currentColumnId, columnId)
      );
    }
  };
  private onDragover = (event: DragEvent) => {
    const el = event.target as HTMLElement;
    const target = el.closest(".vuerd-index-column") as HTMLElement | null;
    if (target) {
      const id = target.dataset.id as string;
      this.draggable$.next(id);
    }
  };

  private onDragstart(event: DragEvent) {
    const nodeList = this.renderRoot.querySelectorAll(".vuerd-index-column");
    nodeList.forEach((node) => {
      node.classList.add("none-hover");
      this.subDraggable.push(
        fromEvent<DragEvent>(node, "dragover")
          .pipe(throttleTime(300))
          .subscribe(this.onDragover)
      );
    });
    const el = event.target as HTMLElement;
    const id = el.dataset.id as string;
    this.currentColumnId = id;
  }
  private onDragend() {
    this.currentColumnId = "";
    this.subDraggable.forEach((sub) => sub.unsubscribe());
    this.subDraggable = [];
    this.renderRoot
      .querySelectorAll(".vuerd-index-column")
      .forEach((node) => node.classList.remove("none-hover"));
  }
  private onRemoveColumn(column: IndexColumn) {
    const { store } = this.context;
    store.dispatch(removeIndexColumn(this.indexId, column.id));
  }
  private onChangeColumnOrderType(column: IndexColumn) {
    const { store } = this.context;
    let value: OrderType = "ASC";
    if (column.orderType === "ASC") {
      value = "DESC";
    }
    store.dispatch(changeIndexColumnOrderType(this.indexId, column.id, value));
  }

  private subscribeColumn() {
    const { store } = this.context;
    const { indexes } = this.context.store.tableState;
    const index = getData(indexes, this.indexId) as Index;
    index.columns.forEach((column) => {
      this.subColumns.push(store.observe(column, () => this.requestUpdate()));
    });
  }
  private unsubscribeColumn() {
    this.subColumns.forEach((sub) => sub.unsubscribe());
    this.subColumns = [];
  }
}
