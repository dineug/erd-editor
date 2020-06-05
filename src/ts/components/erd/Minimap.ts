import { html, svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { defaultWidth, defaultHeight } from "@src/components/Layout";
import { createRelationship } from "@src/components/erd/Relationship";
import { Logger } from "@src/core/Logger";
import {
  SIZE_MINIMAP_WIDTH,
  SIZE_MINIMAP_MARGIN,
  SIZE_MENUBAR_HEIGHT,
} from "@src/core/Layout";
import { Table } from "@src/core/store/Table";
import { Memo } from "@src/core/store/Memo";
import { Relationship } from "@src/core/store/Relationship";

const MARGIN_TOP = SIZE_MENUBAR_HEIGHT + SIZE_MINIMAP_MARGIN;

@customElement("vuerd-minimap")
class Minimap extends EditorElement {
  @property({ type: Number })
  width = defaultWidth;
  @property({ type: Number })
  height = defaultHeight;

  private tables: Table[] = [];
  private memos: Memo[] = [];
  private relationships: Relationship[] = [];
  private subRelationships: Subscription[] = [];

  get styleMap() {
    const {
      width,
      height,
      scrollLeft,
      scrollTop,
    } = this.context.store.canvasState;
    const ratio = SIZE_MINIMAP_WIDTH / width;
    const x = (-1 * width) / 2 + SIZE_MINIMAP_WIDTH / 2;
    const y = (-1 * height) / 2 + (height * ratio) / 2;
    const left =
      x - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN + this.width + scrollLeft;
    const top = y + MARGIN_TOP + scrollTop;
    return {
      transform: `scale(${ratio}, ${ratio})`,
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  }

  get shadowStyle() {
    const { scrollLeft, scrollTop } = this.context.store.canvasState;
    const left =
      this.width + scrollLeft - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN;
    const top = MARGIN_TOP + scrollTop;
    return {
      width: `${SIZE_MINIMAP_WIDTH}px`,
      height: `${SIZE_MINIMAP_WIDTH}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.tables = store.tableState.tables;
    this.memos = store.memoState.memos;
    this.relationships = store.relationshipState.relationships;
    this.subscriptionList.push(
      store.observe(this.tables, () => this.requestUpdate()),
      store.observe(this.memos, () => this.requestUpdate()),
      store.observe(store.canvasState.show, () => this.requestUpdate()),
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "width":
          case "height":
          case "scrollTop":
          case "scrollLeft":
            this.requestUpdate();
            break;
        }
      }),
      store.observe(this.relationships, () => {
        this.unsubscribeRelationships();
        this.observeRelationships();
        this.requestUpdate();
      })
    );
    this.observeRelationships();
  }
  disconnectedCallback() {
    this.unsubscribeRelationships();
    super.disconnectedCallback();
  }

  render() {
    const { width, height } = this.context.store.canvasState;
    const { show } = this.context.store.canvasState;
    return html`
      <div class="vuerd-minimap" style=${styleMap(this.styleMap)}>
        <div class="vuerd-minimap-canvas">
          ${repeat(
            this.tables,
            (table) => table.id,
            (table) =>
              html`
                <vuerd-minimap-table .table=${table}></vuerd-minimap-table>
              `
          )}
          ${repeat(
            this.memos,
            (memo) => memo.id,
            (memo) =>
              html` <vuerd-minimap-memo .memo=${memo}></vuerd-minimap-memo> `
          )}
          ${show.relationship
            ? svg`
            <svg
              class="vuerd-minimap-canvas-svg"
              style=${styleMap({
                width: `${width}px`,
                height: `${height}px`,
              })}
            >
            ${repeat(
              this.relationships,
              (relationship) => relationship.id,
              (relationship) => {
                const shape = createRelationship(relationship, 12);
                return svg`
                  <g
                    class=${classMap({
                      "vuerd-relationship": true,
                      identification: relationship.identification,
                    })}
                  >
                    ${shape}
                  </g>
                `;
              }
            )}
            </svg>
          `
            : ""}
        </div>
      </div>
      <div
        class="vuerd-minimap-shadow"
        style=${styleMap(this.shadowStyle)}
      ></div>
      <vuerd-minimap-handle
        .width=${this.width}
        .height=${this.height}
      ></vuerd-minimap-handle>
    `;
  }

  private observeRelationships() {
    const { store } = this.context;
    this.relationships.forEach((relationship) => {
      this.subRelationships.push(
        store.observe(relationship, () => this.requestUpdate()),
        store.observe(relationship.start, () => this.requestUpdate()),
        store.observe(relationship.end, () => this.requestUpdate())
      );
    });
  }
  private unsubscribeRelationships() {
    this.subRelationships.forEach((sub) => sub.unsubscribe());
    this.subRelationships = [];
  }
}
