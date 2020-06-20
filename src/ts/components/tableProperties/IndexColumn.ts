import { html, customElement, property } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subject, fromEvent, Subscription } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { getData } from "@src/core/Helper";
import { FlipAnimation } from "@src/core/Animation";
import { Table, Column, Index } from "@src/core/store/Table";
import { removeIndexColumn, moveIndexColumn } from "@src/core/command/indexes";

interface IndexModel {
  id: string;
  columns: Column[];
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

  get index(): IndexModel {
    const { indexes } = this.context.store.tableState;
    const index = getData(indexes, this.indexId) as Index;
    return {
      id: index.id,
      columns: index.columnIds
        .map((columnId) => getData(this.table.columns, columnId))
        .filter((column) => column !== null) as Column[],
    };
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { indexes } = store.tableState;
    const index = getData(indexes, this.indexId);
    if (index) {
      this.subscriptionList.push(
        store.observe(index.columnIds, () => this.requestUpdate())
      );
    }
    this.subscriptionList.push(
      this.draggable$.pipe(debounceTime(50)).subscribe(this.onDragoverGroup)
    );
  }
  updated(changedProperties: any) {
    this.flipAnimation.play();
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

  private onRemoveColumn(column: Column) {
    const { store } = this.context;
    store.dispatch(removeIndexColumn(this.indexId, column.id));
  }
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
}
