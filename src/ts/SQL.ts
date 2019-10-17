import { Database } from '@/data/dataType'
import StoreManagement from '@/store/StoreManagement'
import MariaDB from './SQL/MariaDB'
import MSSQL from './SQL/MSSQL'
import MySQL from './SQL/MySQL'
import Oracle from './SQL/Oracle'
import PostgreSQL from './SQL/PostgreSQL'

class SQL {
  public toDDL (store: StoreManagement): string {
    const database = store.canvasStore.state.database
    switch (database) {
      case Database.MariaDB:
        return MariaDB.toDDL(store)
      case Database.MSSQL:
        return MSSQL.toDDL(store)
      case Database.MySQL:
        return MySQL.toDDL(store)
      case Database.Oracle:
        return Oracle.toDDL(store)
      case Database.PostgreSQL:
        return PostgreSQL.toDDL(store)
    }
    return ''
  }
}

export default new SQL()
