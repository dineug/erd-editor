import { html, customElement, property } from "lit-element";
import { Subscription } from "rxjs";
import tuiGrid from "tui-grid";
import { EditorElement } from "./EditorElement";
import { defaultHeight } from "./Layout";
import { Logger } from "@src/core/Logger";
import { SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { getData } from "@src/core/Helper";
import { Bus } from "@src/core/Event";
import { moveKeys, MoveKey, keymapMatch } from "@src/core/Keymap";
import {
  getDataTypeSyncColumns,
  getColumn,
} from "@src/core/helper/ColumnHelper";
import { Command, CommandType } from "@src/core/Command";
import {
  ChangeTableValue,
  changeTableName,
  changeTableComment,
} from "@src/core/command/table";
import {
  changeColumnName,
  changeColumnDataType,
  changeColumnDefault,
  changeColumnComment,
  changeColumnPrimaryKey,
  changeColumnNotNull,
  changeColumnUnique,
  changeColumnAutoIncrement,
} from "@src/core/command/column";
import {
  focusMoveFilter,
  addFilterState,
  removeFilterState,
  editFilter as editFilterCommand,
  editEndFilter,
  selectAllFilterState,
} from "@src/core/command/editor";
import {
  createGridData,
  SimpleOption,
  changeColumnOptionList,
  currentColumnOptionList,
  filterGridData,
} from "@src/core/Grid";
import { GridTextRender } from "./grid/GridTextRender";
import { GridTextEditor } from "./grid/GridTextEditor";
import { GridColumnOptionEditor } from "./grid/GridColumnOptionEditor";
import { GridColumnDataTypeEditor } from "./grid/GridColumnDataTypeEditor";
import "./grid/ColumnOptionEditor";
import "./grid/ColumnDataTypeEditor";
import "./grid/Filter";
import "./grid/filter/FilterState";
import "./grid/filter/FilterTextEditor";
import "./grid/filter/FilterRadioEditor";

const GRID_HEADER_HEIGHT = 40;
const HEADER_HEIGHT = GRID_HEADER_HEIGHT + SIZE_MENUBAR_HEIGHT;

@customElement("vuerd-grid")
class Grid extends EditorElement {
  @property({ type: Number })
  height = defaultHeight;

  private subscriptionList: Subscription[] = [];
  private subFilterStateList: Subscription[] = [];
  private edit = false;
  private grid!: tuiGrid;
  private gridColumns: any = [
    {
      header: "Table Name",
      name: "tableName",
      renderer: { type: GridTextRender, options: { placeholder: "table" } },
      editor: { type: GridTextEditor },
    },
    {
      header: "Table Comment",
      name: "tableComment",
      renderer: { type: GridTextRender, options: { placeholder: "comment" } },
      editor: { type: GridTextEditor },
    },
    {
      header: "Option",
      name: "option",
      minWidth: 100,
      renderer: { type: GridTextRender, options: { placeholder: "option" } },
      editor: { type: GridColumnOptionEditor },
    },
    {
      header: "Name",
      name: "name",
      renderer: { type: GridTextRender, options: { placeholder: "column" } },
      editor: { type: GridTextEditor },
    },
    {
      header: "DataType",
      name: "dataType",
      minWidth: 200,
      renderer: { type: GridTextRender, options: { placeholder: "dataType" } },
      editor: { type: GridColumnDataTypeEditor },
    },
    {
      header: "Default",
      name: "default",
      renderer: { type: GridTextRender, options: { placeholder: "default" } },
      editor: { type: GridTextEditor },
    },
    {
      header: "Comment",
      name: "comment",
      renderer: { type: GridTextRender, options: { placeholder: "comment" } },
      editor: { type: GridTextEditor },
    },
  ];

  get gridHeight() {
    return this.height - HEADER_HEIGHT;
  }

  connectedCallback() {
    super.connectedCallback();
    const { store, helper, keymap, eventBus } = this.context;
    const { keydown$ } = this.context.windowEventObservable;
    this.subscriptionList.push(
      keydown$.subscribe((event) => {
        if (
          !this.edit &&
          (event.key === "Delete" || event.key === "Backspace")
        ) {
          const updatedRows = this.grid.getModifiedRows().updatedRows;
          if (updatedRows) {
            const { tables } = this.context.store.tableState;
            const { relationships } = this.context.store.relationshipState;
            const batchCommand: Array<Command<CommandType>> = [];
            const batchGridDataType: Array<Array<any>> = [];
            const batchGridTableName: Array<{
              tableId: string;
              rowKey: number;
            }> = [];
            const batchGridTableComment: Array<{
              tableId: string;
              rowKey: number;
            }> = [];
            updatedRows.forEach((row: any) => {
              const {
                rowKey,
                tableId,
                columnId,
                tableName,
                tableComment,
                option,
                name,
                dataType,
                comment,
              } = row;
              const table = getData(tables, tableId);
              const column = getColumn(tables, tableId, columnId);
              if (table && column) {
                if (tableName === "" && tableName !== table.name) {
                  if (
                    this.isCommandTable(
                      batchCommand,
                      "table.changeName",
                      tableId
                    )
                  ) {
                    batchCommand.push(changeTableName(helper, tableId, ""));
                    batchGridTableName.push({
                      tableId,
                      rowKey,
                    });
                  }
                }
                if (tableComment === "" && tableComment !== table.comment) {
                  if (
                    this.isCommandTable(
                      batchCommand,
                      "table.changeComment",
                      tableId
                    )
                  ) {
                    batchCommand.push(changeTableComment(helper, tableId, ""));
                    batchGridTableComment.push({
                      tableId,
                      rowKey,
                    });
                  }
                }
                if (option === "") {
                  const changeOptions = currentColumnOptionList(column.option);
                  this.batchCommandColumnOption(
                    batchCommand,
                    changeOptions,
                    tableId,
                    columnId
                  );
                }
                if (name === "" && name !== column.name) {
                  batchCommand.push(
                    changeColumnName(helper, tableId, columnId, "")
                  );
                }
                if (dataType === "" && dataType !== column.dataType) {
                  batchCommand.push(
                    changeColumnDataType(helper, tableId, columnId, "")
                  );
                  // DataTypeSync
                  const columnIds = getDataTypeSyncColumns(
                    [column],
                    tables,
                    relationships
                  ).map((column) => column.id);
                  batchGridDataType.push(
                    this.grid.findRows(
                      (row: any) =>
                        columnIds.some(
                          (columnId) => columnId === row.columnId
                        ) && row.rowKey !== rowKey
                    )
                  );
                }
                if (row.default === "" && row.default !== column.default) {
                  batchCommand.push(
                    changeColumnDefault(helper, tableId, columnId, "")
                  );
                }
                if (comment === "" && row.comment !== column.comment) {
                  batchCommand.push(
                    changeColumnComment(helper, tableId, columnId, "")
                  );
                }
              }
            });
            store.dispatch(...batchCommand);
            batchGridDataType.forEach((rows: any[]) => {
              rows.forEach((row) => {
                this.grid.setValue(row.rowKey, "dataType", "");
              });
            });
            batchGridTableName.forEach(({ tableId, rowKey }) => {
              this.grid
                .findRows(
                  (row: any) => row.tableId === tableId && row.rowKey !== rowKey
                )
                .forEach((row) => {
                  this.grid.setValue(row.rowKey, "tableName", "");
                });
            });
            batchGridTableComment.forEach(({ tableId, rowKey }) => {
              this.grid
                .findRows(
                  (row: any) => row.tableId === tableId && row.rowKey !== rowKey
                )
                .forEach((row) => {
                  this.grid.setValue(row.rowKey, "tableComment", "");
                });
            });
            this.grid.clearModifiedData();
          }
        }

        const {
          focus,
          focusFilter,
          filterActive,
          editFilter,
        } = store.editorState;
        if (focus) {
          if (
            filterActive &&
            focusFilter !== null &&
            editFilter === null &&
            moveKeys.some((moveKey) => moveKey === event.key)
          ) {
            store.dispatch(
              focusMoveFilter(event.key as MoveKey, event.shiftKey)
            );
          }

          if (filterActive && focusFilter !== null && event.key === "Tab") {
            event.preventDefault();
            store.dispatch(focusMoveFilter("ArrowRight", event.shiftKey));
          }

          if (filterActive && keymapMatch(event, keymap.addColumn)) {
            store.dispatch(addFilterState());
          }

          if (
            filterActive &&
            focusFilter !== null &&
            keymapMatch(event, keymap.removeColumn)
          ) {
            const filterStateList = focusFilter.selectFilterStateList;
            if (filterStateList.length !== 0) {
              store.dispatch(
                removeFilterState(
                  filterStateList.map((filterState) => filterState.id)
                )
              );
            }
          }

          if (
            editFilter === null &&
            keymapMatch(event, keymap.selectAllColumn)
          ) {
            store.dispatch(selectAllFilterState());
          }

          if (focusFilter !== null && keymapMatch(event, keymap.edit)) {
            if (editFilter === null) {
              store.dispatch(
                editFilterCommand(
                  focusFilter.currentFocus,
                  focusFilter.currentFocusId
                )
              );
            } else {
              store.dispatch(editEndFilter());
            }
          }

          if (keymapMatch(event, keymap.find)) {
            this.grid.blur();
            eventBus.emit(Bus.Menubar.filter);
          }

          if (filterActive && event.key === "Escape") {
            this.grid.focus(0, "tableName");
          }
        }
      }),
      store.observe(store.editorState.filterStateList, () => {
        this.unsubscribeFilterStateList();
        this.observeFilterStateList();
        this.onFilter();
      }),
      store.observe(store.editorState, (name) => {
        switch (name) {
          case "filterOperatorType":
            this.onFilter();
            break;
        }
      })
    );
  }
  firstUpdated() {
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
      data: [],
    });
    this.onFilter();
    this.grid.on("editingStart", this.onEditingStart);
    this.grid.on("editingFinish", this.onEditingFinish);
    this.grid.focus(0, "tableName");
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
    this.grid.off("editingStart", this.onEditingStart);
    this.grid.off("editingFinish", this.onEditingFinish);
    this.grid.destroy();
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    return html`<div class="vuerd-grid"></div>`;
  }

  private onEditingStart = () => {
    this.edit = true;
  };
  private onEditingFinish = () => {
    this.edit = false;
  };
  private onAfterChange = (event: any) => {
    const { store, helper } = this.context;
    const { value, prevValue, rowKey } = event;
    const row = this.grid.getRow(rowKey) as any;
    if (row) {
      const { tableId, columnId } = row;
      switch (event.columnName) {
        case "tableName":
          store.dispatch(changeTableName(helper, tableId, value));
          this.grid
            .findRows(
              (row: any) => row.tableId === tableId && row.rowKey !== rowKey
            )
            .forEach((row) => {
              this.grid.setValue(row.rowKey, "tableName", value);
            });
          break;
        case "tableComment":
          store.dispatch(changeTableComment(helper, tableId, value));
          this.grid
            .findRows(
              (row: any) => row.tableId === tableId && row.rowKey !== rowKey
            )
            .forEach((row) => {
              this.grid.setValue(row.rowKey, "tableComment", value);
            });
          break;
        case "option":
          const changeOptions = changeColumnOptionList(prevValue, value);
          const batchCommand: Array<Command<CommandType>> = [];
          this.batchCommandColumnOption(
            batchCommand,
            changeOptions,
            tableId,
            columnId
          );
          if (batchCommand.length !== 0) {
            store.dispatch(...batchCommand);
          }
          break;
        case "name":
          store.dispatch(changeColumnName(helper, tableId, columnId, value));
          break;
        case "dataType":
          const { tables } = this.context.store.tableState;
          const { relationships } = this.context.store.relationshipState;
          const column = getColumn(tables, tableId, columnId);
          if (column) {
            store.dispatch(
              changeColumnDataType(helper, tableId, columnId, value)
            );
            // DataTypeSync
            const columnIds = getDataTypeSyncColumns(
              [column],
              tables,
              relationships
            ).map((column) => column.id);
            this.grid
              .findRows(
                (row: any) =>
                  columnIds.some((columnId) => columnId === row.columnId) &&
                  row.rowKey !== rowKey
              )
              .forEach((row) => {
                this.grid.setValue(row.rowKey, "dataType", value);
              });
          }
          break;
        case "default":
          store.dispatch(changeColumnDefault(helper, tableId, columnId, value));
          break;
        case "comment":
          store.dispatch(changeColumnComment(helper, tableId, columnId, value));
          break;
      }
    }
    this.grid.clearModifiedData();
  };

  private onFilter() {
    const { store } = this.context;
    const rows = filterGridData(store) as any[];
    if (rows.length === 0) {
      if (this.grid.findRows((row) => true).length !== 0) {
        this.grid.clear();
      }
    } else {
      this.grid.clear();
      this.grid.resetData(rows);
    }
  }

  private batchCommandColumnOption(
    batchCommand: Array<Command<CommandType>>,
    changeOptions: SimpleOption[],
    tableId: string,
    columnId: string
  ) {
    const { store } = this.context;
    changeOptions.forEach((simpleOption) => {
      switch (simpleOption) {
        case "PK":
          batchCommand.push(changeColumnPrimaryKey(store, tableId, columnId));
          break;
        case "NN":
          batchCommand.push(changeColumnNotNull(store, tableId, columnId));
          break;
        case "UQ":
          batchCommand.push(changeColumnUnique(store, tableId, columnId));
          break;
        case "AI":
          batchCommand.push(
            changeColumnAutoIncrement(store, tableId, columnId)
          );
          break;
      }
    });
  }
  private isCommandTable(
    batchCommand: Array<Command<CommandType>>,
    commandType: CommandType,
    tableId: string
  ) {
    return !batchCommand.some((command) => {
      if (command.type === commandType) {
        const data = command.data as ChangeTableValue;
        return data.tableId === tableId;
      }
      return false;
    });
  }
  private observeFilterStateList() {
    const { store } = this.context;
    const { filterStateList } = this.context.store.editorState;
    filterStateList.forEach((filterState) => {
      this.subFilterStateList.push(
        store.observe(filterState, () => this.onFilter())
      );
    });
  }
  private unsubscribeFilterStateList() {
    this.subFilterStateList.forEach((sub) => sub.unsubscribe());
    this.subFilterStateList = [];
  }
}
