import { ColumnFocus } from './ColumnFocusModel'
import { FocusType, TableFocus } from './TableFocusModel'
import StoreManagement from '@/store/StoreManagement'
import { Column } from '@/store/table'
import { getData } from '@/ts/util'

export function focusAllEnd (table: TableFocus) {
  tableFocusAllEnd(table)
  columnFocusAllEnd(table.focusColumns)
}

export function tableFocusAllEnd (table: TableFocus) {
  table.focusName = false
  table.focusComment = false
}

export function columnFocusAllEnd (columns: ColumnFocus[]) {
  columns.forEach((column) => {
    column.focusName = false
    column.focusComment = false
    column.focusDataType = false
    column.focusDefault = false
    column.focusNotNull = false
  })
}

export function moveArrowLeft (
  store: StoreManagement,
  table: TableFocus,
  currentFocusTable: boolean,
  currentColumn: Column | null,
  event: KeyboardEvent
) {
  if (currentFocusTable) {
    if (table.focusName && store.canvasStore.state.show.tableComment) {
      table.focus(FocusType.tableComment)
    } else {
      table.focus(FocusType.tableName)
    }
    selectedMove(table, null)
  } else if (currentColumn) {
    const focusColumn = getData(table.focusColumns, currentColumn.id)
    if (focusColumn) {
      table.focus(focusColumn.preFocus(), currentColumn)
      selectedMove(table, currentColumn, event)
    }
  }
}

export function moveArrowRight (
  store: StoreManagement,
  table: TableFocus,
  currentFocusTable: boolean,
  currentColumn: Column | null,
  event: KeyboardEvent
) {
  if (currentFocusTable) {
    if (table.focusName && store.canvasStore.state.show.tableComment) {
      table.focus(FocusType.tableComment)
    } else {
      table.focus(FocusType.tableName)
    }
    selectedMove(table, null)
  } else if (currentColumn) {
    const focusColumn = getData(table.focusColumns, currentColumn.id)
    if (focusColumn) {
      table.focus(focusColumn.nextFocus(), currentColumn)
      selectedMove(table, currentColumn, event)
    }
  }
}

export function moveArrowUp (
  store: StoreManagement,
  table: TableFocus,
  currentFocusTable: boolean,
  currentColumn: Column | null,
  event: KeyboardEvent
) {
  if (currentFocusTable) {
    if (table.columns.length !== 0) {
      const column = table.columns[table.columns.length - 1]
      table.focus(FocusType.columnName, column)
      selectedMove(table, column, event)
    }
  } else if (currentColumn) {
    const focusColumn = getData(table.focusColumns, currentColumn.id)
    if (focusColumn) {
      const index = table.columns.indexOf(currentColumn)
      if (index === 0) {
        table.focus(FocusType.tableName)
        selectedMove(table, null)
      } else {
        const column = table.columns[index - 1]
        table.focus(focusColumn.currentFocus(), column)
        selectedMove(table, column, event)
      }
    }
  }
}

export function moveArrowDown (
  store: StoreManagement,
  table: TableFocus,
  currentFocusTable: boolean,
  currentColumn: Column | null,
  event: KeyboardEvent
) {
  if (currentFocusTable) {
    if (table.columns.length !== 0) {
      const column = table.columns[0]
      table.focus(FocusType.columnName, column)
      selectedMove(table, column, event)
    }
  } else if (currentColumn) {
    const focusColumn = getData(table.focusColumns, currentColumn.id)
    if (focusColumn) {
      const index = table.columns.indexOf(currentColumn)
      if (index === table.columns.length - 1) {
        table.focus(FocusType.tableName)
        selectedMove(table, null)
      } else {
        const column = table.columns[index + 1]
        table.focus(focusColumn.currentFocus(), column)
        selectedMove(table, column, event)
      }
    }
  }
}

export function selectedMove (table: TableFocus, currentColumn: Column | null, event?: KeyboardEvent) {
  if (currentColumn) {
    if (event && event.shiftKey) {
      for (const column of table.focusColumns) {
        if (column.id === currentColumn.id) {
          column.selected = true
          break
        }
      }
    } else {
      table.focusColumns.forEach((column) => {
        if (currentColumn) {
          column.selected = column.id === currentColumn.id
        }
      })
    }
  } else {
    table.focusColumns.forEach((column) => column.selected = false)
  }
}
