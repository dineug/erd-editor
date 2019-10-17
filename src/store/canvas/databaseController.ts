import { State } from '../canvas'
import { Database } from '@/data/dataType'
import { log } from '@/ts/util'

export function databaseChange (state: State, database: Database) {
  log.debug('databaseController databaseChange')
  state.database = database
}
