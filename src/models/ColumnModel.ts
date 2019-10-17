import { SIZE_MIN_WIDTH } from '@/ts/layout'
import { Table, Column, ColumnOption, ColumnUI } from '@/store/table'
import { uuid, autoName } from '@/ts/util'
import StoreManagement from '@/store/StoreManagement'

export default class ColumnModel implements Column {
  public id: string
  public name: string = ''
  public comment: string = ''
  public dataType: string = ''
  public default: string = ''
  public option: ColumnOption
  public ui: ColumnUI
  private store: StoreManagement

  constructor (store: StoreManagement, data?: { load?: Column, copy?: { table: Table, column: Column } }) {
    this.store = store
    if (data && data.load) {
      const {load} = data
      this.id = load.id
      this.name = load.name
      this.comment = load.comment
      this.dataType = load.dataType
      this.default = load.default
      this.option = load.option
      this.ui = load.ui
    } else if (data && data.copy) {
      const {table, column} = data.copy
      this.id = uuid()
      this.name = autoName(table.columns, this.id, column.name)
      this.comment = column.comment
      this.dataType = column.dataType
      this.default = column.default
      this.option = {
        autoIncrement: column.option.autoIncrement,
        primaryKey: column.option.primaryKey,
        unique: column.option.unique,
        notNull: column.option.notNull
      }
      this.ui = {
        active: column.ui.active,
        pk: column.ui.pk,
        fk: column.ui.fk,
        pfk: column.ui.pfk,
        widthName: column.ui.widthName,
        widthComment: column.ui.widthComment,
        widthDataType: column.ui.widthDataType,
        widthDefault: column.ui.widthDefault
      }
    } else {
      this.id = uuid()
      this.option = {
        autoIncrement: false,
        primaryKey: false,
        unique: false,
        notNull: false
      }
      this.ui = {
        active: false,
        pk: false,
        fk: false,
        pfk: false,
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH,
        widthDataType: SIZE_MIN_WIDTH,
        widthDefault: SIZE_MIN_WIDTH
      }
    }
  }
}
