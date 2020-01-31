import { State } from "../canvas";
import { Database } from "@/data/DataType";
import { log } from "@/ts/util";

export function databaseChange(state: State, database: Database) {
  log.debug("databaseController databaseChange");
  state.database = database;
}
