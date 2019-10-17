import { SIZE_TABLE_PADDING } from '@/ts/layout'
import { Edit, State, Table } from '../table'
import { Commit as MemoCommit, Memo } from '@/store/memo'
import { Commit as RelationshipCommit } from '@/store/relationship'
import TableModel from '@/models/TableModel'
import { zIndexNext } from './tableHelper'
import { log } from '@/ts/util'
import TableFocusModel, { FocusType } from '@/models/TableFocusModel'
import StoreManagement from '@/store/StoreManagement'
import { Bus } from '@/ts/EventBus'
import { relationshipSort } from '@/store/relationship/relationshipHelper'

const TABLE_PADDING = SIZE_TABLE_PADDING * 2

export function tableAdd (state: State, store: StoreManagement) {
  log.debug('tableController tableAdd')
  tableSelectAllEnd(state)
  store.memoStore.commit(MemoCommit.memoSelectAllEnd)
  const table = new TableModel(store)
  state.tables.push(table)
  tableFocusStart(state, { table, store })
  store.eventBus.$emit(Bus.ERD.change)
}

export function tableMove (
  state: State,
  payload: {
    table: Table,
    x: number, y: number,
    event: MouseEvent,
    store: StoreManagement,
  }) {
  // log.debug('tableController tableMove');
  const { table, x, y, event, store } = payload
  if (event.ctrlKey) {
    state.tables.forEach((value: Table) => {
      if (value.ui.active) {
        value.ui.top += y
        value.ui.left += x
      }
    })
    store.memoStore.state.memos.forEach((value: Memo) => {
      if (value.ui.active) {
        value.ui.top += y
        value.ui.left += x
      }
    })
  } else {
    table.ui.top += y
    table.ui.left += x
  }
  relationshipSort(state.tables, store.relationshipStore.state.relationships)
}

export function tableRemove (state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('tableController tableRemove')
  const { table, store } = payload
  const index = state.tables.indexOf(table)
  state.tables.splice(index, 1)
  store.relationshipStore.commit(RelationshipCommit.relationshipRemoveTable, {
    table,
    store
  })
  store.eventBus.$emit(Bus.ERD.change)
}

export function tableRemoveAll (state: State, store: StoreManagement) {
  log.debug('tableController tableRemoveAll')
  for (let i = 0; i < state.tables.length; i++) {
    if (state.tables[i].ui.active) {
      store.relationshipStore.commit(RelationshipCommit.relationshipRemoveTable, {
        table: state.tables[i],
        store
      })
      state.tables.splice(i, 1)
      i--
    }
  }
  store.eventBus.$emit(Bus.ERD.change)
}

export function tableSelect (state: State, payload: { table: Table, event: MouseEvent, store: StoreManagement }) {
  log.debug('tableController tableSelect')
  const { table, event, store } = payload
  table.ui.zIndex = zIndexNext(state.tables, store.memoStore.state.memos)
  if (event.ctrlKey) {
    table.ui.active = true
  } else {
    state.tables.forEach((value: Table) => value.ui.active = value.id === table.id)
    store.memoStore.commit(MemoCommit.memoSelectAllEnd)
  }
  tableFocusStart(state, { table, store })
  if (store.relationshipStore.state.draw) {
    if (store.relationshipStore.state.draw.start) {
      store.relationshipStore.commit(RelationshipCommit.relationshipDrawEnd, {
        table,
        store
      })
    } else {
      store.relationshipStore.commit(RelationshipCommit.relationshipDrawStartAdd, {
        table,
        store
      })
    }
  }
}

export function tableSelectAll (state: State) {
  log.debug('tableController tableSelectAll')
  state.tables.forEach((table: Table) => table.ui.active = true)
}

export function tableSelectAllEnd (state: State) {
  log.debug('tableController tableSelectAllEnd')
  state.tables.forEach((table: Table) => table.ui.active = false)
  tableFocusEnd(state)
}

export function tableMultipleSelect (
  state: State,
  payload: {
    min: { x: number, y: number },
    max: { x: number, y: number },
  }) {
  log.debug('tableController tableMultipleSelect')
  const { min, max } = payload
  state.tables.forEach((table: Table) => {
    const centerX = table.ui.left + (table.width() / 2) + TABLE_PADDING
    const centerY = table.ui.top + (table.height() / 2) + TABLE_PADDING
    table.ui.active = !!(min.x <= centerX && centerX <= max.x &&
      min.y <= centerY && centerY <= max.y)
  })
}

export function tableFocusStart (state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('tableController tableFocusStart')
  const { table, store } = payload
  if (!state.tableFocus || state.tableFocus.id !== table.id) {
    state.tableFocus = new TableFocusModel(store, table)
  }
}

export function tableFocusEnd (state: State) {
  log.debug('tableController tableFocusEnd')
  state.tableFocus = null
  state.edit = null
}

export function tableFocus (state: State, focusType: FocusType) {
  log.debug('tableController tableFocus')
  if (state.tableFocus) {
    state.tableFocus.focus(focusType)
    state.tableFocus.selected()
  }
}

export function tableFocusMove (state: State, event: KeyboardEvent) {
  log.debug('tableController tableFocusMove')
  if (state.tableFocus) {
    state.tableFocus.move(event)
  }
}

export function tableEditStart (state: State, edit: Edit) {
  log.debug('tableController editStart')
  state.edit = edit
}

export function tableEditEnd (state: State, store: StoreManagement) {
  log.debug('tableController editEnd')
  state.edit = null
  relationshipSort(state.tables, store.relationshipStore.state.relationships)
  store.eventBus.$emit(Bus.ERD.change)
}
