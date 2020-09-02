import { Subscription } from "rxjs";
import { Store } from "./Store";
import { isObject, Helper } from "./Helper";
import { createJsonStringify } from "./File";
import { loadJson, initLoadJson, clear } from "./command/editor";
import { sortTable } from "./command/table";
import { DDLParser } from "./SQLParser";
import { createJson } from "./SQLParserToJson";
import { createDDL } from "./SQL";
import { Database, databaseList } from "./store/Canvas";
import { User, Command, CommandType } from "../types";

export class ERDEngine {
  private store = new Store();
  private subShare: Subscription | null = null;
  private helper = new Helper();

  get value() {
    const { store } = this;
    return createJsonStringify(store);
  }

  set value(json: string) {
    const { store } = this;
    if (typeof json === "string" && json.trim() !== "") {
      store.dispatch(loadJson(json));
    } else {
      store.dispatch(clear());
    }
  }

  initLoadJson(json: string): void {
    if (typeof json === "string" && json.trim() !== "") {
      const { store } = this;
      store.dispatch(initLoadJson(json));
    }
  }
  loadSQLDDL(sql: string) {
    if (typeof sql === "string" && sql.trim() !== "") {
      const { store, helper } = this;
      const statements = DDLParser(sql);
      const json = createJson(statements, helper, store.canvasState.database);
      store.dispatch(loadJson(json), sortTable());
    }
  }
  clear(): void {
    const { store } = this;
    store.dispatch(clear());
  }
  setUser(user: User): void {
    const { store } = this;
    if (isObject(user) && user.name) {
      store.user.name = user.name;
    }
  }
  sharePull(effect: (commands: any) => void): void {
    if (typeof effect === "function") {
      const { store } = this;
      this.subShare?.unsubscribe();
      this.subShare = null;
      this.subShare = store.share$.subscribe(effect);
      store.editorState.undoManager = false;
    }
  }
  sharePush(commands: Array<Command<CommandType>>): void {
    if (Array.isArray(commands)) {
      const { store } = this;
      store.dispatch(...commands);
      store.editorState.undoManager = false;
    }
  }
  getSQLDDL(database?: Database) {
    const { store } = this;
    if (database && databaseList.includes(database)) {
      return createDDL(store, database);
    }
    return createDDL(store);
  }
}
