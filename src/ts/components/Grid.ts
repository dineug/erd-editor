import { html, customElement, property } from "lit-element";
import { Subscription } from "rxjs";
import tuiGrid from "tui-grid";
import { EditorElement } from "./EditorElement";
import { defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { createGridData } from "@src/core/Grid";

const GRID_HEADER_HEIGHT = 40;
const HEADER_HEIGHT = GRID_HEADER_HEIGHT + SIZE_MENUBAR_HEIGHT;

@customElement("vuerd-grid")
class Grid extends EditorElement {
  @property({ type: Number })
  height = defaultHeight;

  private grid!: tuiGrid;

  get gridHeight() {
    return this.height - HEADER_HEIGHT;
  }

  firstUpdated() {
    const { store } = this.context;
    const rows = createGridData(store) as any;
    const container = this.renderRoot.querySelector(
      ".vuerd-grid"
    ) as HTMLElement;
    this.grid = new tuiGrid({
      el: container,
      usageStatistics: false,
      bodyHeight: this.gridHeight,
      columnOptions: {
        frozenCount: 1,
        frozenBorderWidth: 0,
        minWidth: 300,
      },
      columns: [
        {
          header: "Table Name",
          name: "tableName",
          editor: "text",
        },
        {
          header: "Table Comment",
          name: "tableComment",
          editor: "text",
        },
        {
          header: "Option",
          name: "option",
          onBeforeChange(ev) {
            Logger.debug("Before change");
            Logger.debug(ev);
          },
          onAfterChange(ev) {
            Logger.debug("After change");
            Logger.debug(ev);
          },
          formatter: "listItemText",
          editor: {
            type: "checkbox",
            options: {
              listItems: [
                { text: "PK", value: "PK" },
                { text: "NN", value: "NN" },
                { text: "UQ", value: "UQ" },
                { text: "AI", value: "AI" },
              ],
            },
          },
          copyOptions: {
            useListItemText: true,
          },
        },
        {
          header: "Name",
          name: "name",
          editor: "text",
        },
        {
          header: "DataType",
          name: "dataType",
          editor: "text",
        },
        {
          header: "Default",
          name: "default",
          editor: "text",
        },
        {
          header: "Comment",
          name: "comment",
          editor: "text",
        },
      ],
      data: rows,
    });
  }
  updated(changedProperties: any) {
    changedProperties.forEach((oldValue: any, propName: string) => {
      switch (propName) {
        case "height":
          this.grid.setBodyHeight(this.gridHeight);
          break;
      }
    });
  }
  disconnectedCallback() {
    this.grid.destroy();
    super.disconnectedCallback();
  }

  render() {
    return html`<div class="vuerd-grid"></div>`;
  }
}
