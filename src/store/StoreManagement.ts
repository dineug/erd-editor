import {
  Commit as CanvasCommit,
  State as CanvasState,
  createStore as createdStoreCanvas
} from "./canvas";
import {
  Commit as TableCommit,
  State as TableState,
  createStore as createdStoreTable
} from "./table";
import {
  Commit as MemoCommit,
  State as MemoState,
  createStore as createdStoreMemo
} from "./memo";
import {
  Commit as RelationshipCommit,
  State as RelationshipState,
  createStore as createStoreRelationship
} from "./relationship";
import EventBus from "@/ts/EventBus";
import { log, uuid } from "@/ts/util";
import { Store } from "vuex";

export default class StoreManagement {
  public canvasStore: Store<CanvasState>;
  public tableStore: Store<TableState>;
  public memoStore: Store<MemoState>;
  public relationshipStore: Store<RelationshipState>;
  public eventBus: EventBus;
  public uuid: string = uuid();

  constructor() {
    this.canvasStore = createdStoreCanvas();
    this.tableStore = createdStoreTable();
    this.memoStore = createdStoreMemo();
    this.relationshipStore = createStoreRelationship();
    this.eventBus = new EventBus();
  }

  public init() {
    log.debug("DataManagement init");
    this.canvasStore.commit(CanvasCommit.init);
    this.tableStore.commit(TableCommit.init);
    this.memoStore.commit(MemoCommit.init);
    this.relationshipStore.commit(RelationshipCommit.init);
  }

  public load(value: string) {
    log.debug("DataManagement load");
    const data = JSON.parse(value);
    this.canvasStore.commit(CanvasCommit.load, data.canvas);
    this.tableStore.commit(TableCommit.load, {
      load: data.table,
      store: this
    });
    this.memoStore.commit(MemoCommit.load, data.memo);
    this.relationshipStore.commit(RelationshipCommit.load, data.relationship);
  }

  get value(): string {
    log.debug("DataManagement value");
    const data = {
      canvas: this.canvasStore.state,
      table: this.tableStore.state,
      memo: this.memoStore.state,
      relationship: this.relationshipStore.state
    };
    return JSON.stringify(
      data,
      (key, value) => {
        if (key === "store") {
          return undefined;
        } else if (key === "columnDraggable") {
          return null;
        }
        return value;
      },
      2
    );
  }

  public destroyed() {
    delete this.canvasStore;
    delete this.tableStore;
    delete this.memoStore;
    delete this.relationshipStore;
    delete this.eventBus;
  }
}
