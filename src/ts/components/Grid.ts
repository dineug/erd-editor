import { html, customElement, property } from "lit-element";
import { Subscription } from "rxjs";
import tuiGrid from "tui-grid";
import { EditorElement } from "./EditorElement";
import { defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { createGridData } from "@src/core/Grid";
import { GridTextEditor } from "./grid/GridTextEditor";
import { GridColumnOptionEditor } from "./grid/GridColumnOptionEditor";
import "./grid/ColumnOptionEditor";

const GRID_HEADER_HEIGHT = 40;
const HEADER_HEIGHT = GRID_HEADER_HEIGHT + SIZE_MENUBAR_HEIGHT;

@customElement("vuerd-grid")
class Grid extends EditorElement {
  @property({ type: Number })
  height = defaultHeight;

  private grid!: tuiGrid;
  private subscriptionList: Subscription[] = [];
  private gridColumns: any = [
    {
      header: "Table Name",
      name: "tableName",
      editor: { type: GridTextEditor },
    },
    {
      header: "Table Comment",
      name: "tableComment",
      editor: { type: GridTextEditor },
    },
    {
      header: "Option",
      name: "option",
      minWidth: 100,
      editor: {
        type: GridColumnOptionEditor,
      },
    },
    {
      header: "Name",
      name: "name",
      editor: { type: GridTextEditor },
    },
    {
      header: "DataType",
      name: "dataType",
      minWidth: 200,
      editor: { type: GridTextEditor },
    },
    {
      header: "Default",
      name: "default",
      editor: { type: GridTextEditor },
    },
    {
      header: "Comment",
      name: "comment",
      editor: { type: GridTextEditor },
    },
  ];

  get gridHeight() {
    return this.height - HEADER_HEIGHT;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const { keydown$ } = this.context.windowEventObservable;
    this.subscriptionList.push(
      keydown$.subscribe((event) => {
        if (event.key === "Delete" || event.key === "Backspace") {
          Logger.debug(this.grid.getModifiedRows());
        }
      })
    );
  }
  firstUpdated() {
    const { store } = this.context;
    const rows = createGridData(store) as any;
    const container = this.renderRoot.querySelector(
      ".vuerd-grid"
    ) as HTMLElement;
    const gridDefaultColumn: any = {
      sortingType: "asc",
      sortable: true,
      onAfterChange: this.onAfterChange,
    };
    this.gridColumns.forEach((gridColumn: any) => {
      gridColumn = Object.assign(gridColumn, gridDefaultColumn);
    });
    this.grid = new tuiGrid({
      el: container,
      usageStatistics: false,
      bodyHeight: this.gridHeight,
      columnOptions: {
        frozenCount: 1,
        frozenBorderWidth: 0,
        minWidth: 300,
      },
      columns: this.gridColumns,
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
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`<div class="vuerd-grid"></div>`;
  }

  private onAfterChange = (ev: any) => {
    Logger.debug("Grid onAfterChange", ev);
    Logger.debug(this.grid);
    Logger.debug(this.grid.getModifiedRows());
  };
}
