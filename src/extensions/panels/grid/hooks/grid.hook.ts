import { CommandTypeAll, CommandKey } from '@@types/engine/command';
import { ChangeTableValue } from '@@types/engine/command/table.cmd';
import { query, mounted, unmounted, watch } from '@dineug/lit-observable';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import Grid from 'tui-grid';
import {
  GridEditorProps,
  GridEditorElement,
} from '@/extensions/panels/grid/components/GridEditor';
import { gridColumns } from '@/extensions/panels/grid/core/config';
import {
  filterGridData,
  SimpleOption,
} from '@/extensions/panels/grid/core/helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import {
  changeColumnOptionList,
  currentColumnOptionList,
} from '@/extensions/panels/grid/core/helper';
import {
  getColumn,
  getDataTypeSyncColumns,
} from '@/engine/store/helper/column.helper';
import { getData, createSubscriptionHelper } from '@/core/helper';

const GRID_HEADER_HEIGHT = 40;

export function useGrid(
  props: GridEditorProps,
  ctx: GridEditorElement,
  keydown$: Subject<KeyboardEvent>
) {
  const containerRef = query<HTMLElement>('.vuerd-grid-container');
  const gridRef: { value: Grid | null } = { value: null };
  const { unmountedGroup } = useUnmounted();
  const filter$ = new Subject();
  const subscriptionHelper = createSubscriptionHelper();

  let deleteBatchExecuting = false;
  let changeBatchExecuting = false;
  let deleteDataTypeSyncExecuting = false;
  let changeDataTypeSyncExecuting = false;
  let edit = false;

  const getHeight = () => props.height - GRID_HEADER_HEIGHT;

  const batchCommandColumnOption = (
    batchCommand: CommandTypeAll[],
    changeOptions: SimpleOption[],
    tableId: string,
    columnId: string
  ) => {
    const { store, command } = ctx.api;
    const {
      changeColumnPrimaryKey,
      changeColumnNotNull,
      changeColumnUnique,
      changeColumnAutoIncrement,
    } = command.column;

    changeOptions.forEach(simpleOption => {
      switch (simpleOption) {
        case 'PK':
          batchCommand.push(changeColumnPrimaryKey(store, tableId, columnId));
          break;
        case 'NN':
          batchCommand.push(changeColumnNotNull(store, tableId, columnId));
          break;
        case 'UQ':
          batchCommand.push(changeColumnUnique(store, tableId, columnId));
          break;
        case 'AI':
          batchCommand.push(
            changeColumnAutoIncrement(store, tableId, columnId)
          );
          break;
      }
    });
  };

  const onAfterChange = (event: any) => {
    if (!gridRef.value) return;

    const grid = gridRef.value;
    const { store, helper, command } = ctx.api;
    const { changeTableName, changeTableComment } = command.table;
    const {
      changeColumnName,
      changeColumnDataType,
      changeColumnDefault,
      changeColumnComment,
    } = command.column;
    const {
      canvasState: { setting },
      tableState: { tables },
      relationshipState: { relationships },
    } = store;
    const { value, prevValue, rowKey } = event;
    const row = grid.getRow(rowKey) as any;

    if (row) {
      const { tableId, columnId } = row;

      switch (event.columnName) {
        case 'tableName':
          if (!deleteBatchExecuting && !changeBatchExecuting) {
            changeBatchExecuting = true;

            store.dispatch(changeTableName(helper, tableId, value));
            grid
              .findRows(
                (row: any) => row.tableId === tableId && row.rowKey !== rowKey
              )
              .forEach(row => {
                grid.setValue(row.rowKey, 'tableName', value);
              });

            changeBatchExecuting = false;
          }
          break;
        case 'tableComment':
          if (!deleteBatchExecuting && !changeBatchExecuting) {
            changeBatchExecuting = true;

            store.dispatch(changeTableComment(helper, tableId, value));
            grid
              .findRows(
                (row: any) => row.tableId === tableId && row.rowKey !== rowKey
              )
              .forEach(row => {
                grid.setValue(row.rowKey, 'tableComment', value);
              });

            changeBatchExecuting = false;
          }
          break;
        case 'option':
          const changeOptions = changeColumnOptionList(prevValue, value);
          const batchCommand: CommandTypeAll[] = [];

          batchCommandColumnOption(
            batchCommand,
            changeOptions,
            tableId,
            columnId
          );

          if (batchCommand.length !== 0) {
            store.dispatch(...batchCommand);
          }
          break;
        case 'name':
          store.dispatch(changeColumnName(helper, tableId, columnId, value));
          break;
        case 'dataType':
          if (!deleteDataTypeSyncExecuting && !changeDataTypeSyncExecuting) {
            changeDataTypeSyncExecuting = true;

            const column = getColumn(tables, tableId, columnId);

            if (column) {
              store.dispatch(
                changeColumnDataType(helper, tableId, columnId, value)
              );

              if (setting.relationshipDataTypeSync) {
                // DataTypeSync
                const columnIds = getDataTypeSyncColumns(
                  [column],
                  tables,
                  relationships
                ).map(column => column.id);

                grid
                  .findRows(
                    (row: any) =>
                      columnIds.some(columnId => columnId === row.columnId) &&
                      row.rowKey !== rowKey
                  )
                  .forEach(row => {
                    grid.setValue(row.rowKey, 'dataType', value);
                  });
              }
            }

            changeDataTypeSyncExecuting = false;
          }
          break;
        case 'default':
          store.dispatch(changeColumnDefault(helper, tableId, columnId, value));
          break;
        case 'comment':
          store.dispatch(changeColumnComment(helper, tableId, columnId, value));
          break;
      }
    }

    grid.clearModifiedData();
  };

  const isCommandTable = (
    batchCommand: CommandTypeAll[],
    commandName: CommandKey,
    tableId: string
  ) =>
    !batchCommand.some(command => {
      if (command.name === commandName) {
        const data = command.data as ChangeTableValue;
        return data.tableId === tableId;
      }
      return false;
    });

  const onKeydown = (event: KeyboardEvent) => {
    if (!gridRef.value) return;
    const grid = gridRef.value;
    const { store, helper, command } = ctx.api;
    const {
      canvasState: { setting },
      tableState: { tables },
      relationshipState: { relationships },
    } = store;
    const { changeTableName, changeTableComment } = command.table;
    const {
      changeColumnName,
      changeColumnDataType,
      changeColumnDefault,
      changeColumnComment,
    } = command.column;

    if (!edit && (event.key === 'Delete' || event.key === 'Backspace')) {
      const updatedRows = grid.getModifiedRows().updatedRows;
      if (!updatedRows) return;

      const batchCommand: CommandTypeAll[] = [];
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
          if (tableName === '' && tableName !== table.name) {
            if (isCommandTable(batchCommand, 'table.changeName', tableId)) {
              batchCommand.push(changeTableName(helper, tableId, ''));
              batchGridTableName.push({
                tableId,
                rowKey,
              });
            }
          }
          if (tableComment === '' && tableComment !== table.comment) {
            if (isCommandTable(batchCommand, 'table.changeComment', tableId)) {
              batchCommand.push(changeTableComment(helper, tableId, ''));
              batchGridTableComment.push({
                tableId,
                rowKey,
              });
            }
          }
          if (option === '') {
            const changeOptions = currentColumnOptionList(column.option);
            batchCommandColumnOption(
              batchCommand,
              changeOptions,
              tableId,
              columnId
            );
          }
          if (name === '' && name !== column.name) {
            batchCommand.push(changeColumnName(helper, tableId, columnId, ''));
          }
          if (dataType === '' && dataType !== column.dataType) {
            batchCommand.push(
              changeColumnDataType(helper, tableId, columnId, '')
            );
            if (setting.relationshipDataTypeSync) {
              // DataTypeSync
              const columnIds = getDataTypeSyncColumns(
                [column],
                tables,
                relationships
              ).map(column => column.id);
              batchGridDataType.push(
                grid.findRows(
                  (row: any) =>
                    columnIds.some(columnId => columnId === row.columnId) &&
                    row.rowKey !== rowKey
                )
              );
            }
          }
          if (row.default === '' && row.default !== column.default) {
            batchCommand.push(
              changeColumnDefault(helper, tableId, columnId, '')
            );
          }
          if (comment === '' && row.comment !== column.comment) {
            batchCommand.push(
              changeColumnComment(helper, tableId, columnId, '')
            );
          }
        }
      });
      store.dispatch(...batchCommand);

      deleteDataTypeSyncExecuting = true;
      batchGridDataType.forEach((rows: any[]) => {
        rows.forEach(row => {
          grid.setValue(row.rowKey, 'dataType', '');
        });
      });
      deleteDataTypeSyncExecuting = false;

      deleteBatchExecuting = true;
      batchGridTableName.forEach(({ tableId, rowKey }) => {
        grid
          .findRows(
            (row: any) => row.tableId === tableId && row.rowKey !== rowKey
          )
          .forEach(row => {
            grid.setValue(row.rowKey, 'tableName', '');
          });
      });
      batchGridTableComment.forEach(({ tableId, rowKey }) => {
        grid
          .findRows(
            (row: any) => row.tableId === tableId && row.rowKey !== rowKey
          )
          .forEach(row => {
            grid.setValue(row.rowKey, 'tableComment', '');
          });
      });
      deleteBatchExecuting = false;

      grid.clearModifiedData();
    }
  };

  const observeFilters = () => {
    const { filters } = ctx.api.store.editorState.filterState;
    subscriptionHelper.push(
      ...filters.map(filter => watch(filter, () => filter$.next()))
    );
  };
  const unobserveFilters = () => subscriptionHelper.destroy();

  const onFilter = () => {
    if (!gridRef.value) return;
    const { store } = ctx.api;
    gridRef.value.resetData(filterGridData(store) as any);
  };

  const onEditingStart = () => (edit = true);
  const onEditingFinish = () => (edit = false);

  const onGridEvent = () => {
    if (!gridRef.value) return;
    gridRef.value.on('editingStart', onEditingStart);
    gridRef.value.on('editingFinish', onEditingFinish);
  };
  const offGridEvent = () => {
    if (!gridRef.value) return;
    gridRef.value.off('editingStart', onEditingStart);
    gridRef.value.off('editingFinish', onEditingFinish);
  };

  mounted(() => {
    const { filterState } = ctx.api.store.editorState;

    gridRef.value = new Grid({
      el: containerRef.value,
      usageStatistics: false,
      bodyHeight: getHeight(),
      columnOptions: {
        frozenCount: 1,
        frozenBorderWidth: 0,
        minWidth: 300,
      },
      columns: gridColumns.map((gridColumn: any) => ({
        ...gridColumn,
        onAfterChange,
      })),
      data: [],
    });

    onGridEvent();
    onFilter();

    unmountedGroup.push(
      keydown$.subscribe(onKeydown),
      filter$.pipe(debounceTime(200)).subscribe(onFilter),
      watch(props, propName => {
        if (propName !== 'height' || !gridRef.value) return;

        gridRef.value.setBodyHeight(getHeight());
      }),
      watch(filterState, propName => {
        if (propName !== 'filterOperatorType') return;
        filter$.next();
      }),
      watch(filterState.filters, () => {
        unobserveFilters();
        observeFilters();
        filter$.next();
      })
    );
  });

  unmounted(() => {
    if (!gridRef.value) return;
    offGridEvent();
    gridRef.value.destroy();
  });

  return gridRef as { value: Grid };
}
