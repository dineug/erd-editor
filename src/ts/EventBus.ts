import { Subscription, Subject } from "rxjs";

interface Listener {
  sub: Subscription;

  callback(data?: any): void;
}

interface Bus$ {
  string: Subject<any>;
}

class EventBus {
  private bus$!: Bus$ | any;
  private listeners: Listener[] = [];

  constructor() {
    this.bus$ = new Proxy<Bus$ | any>(
      {},
      {
        get(target: Bus$ | any, p: string): any {
          if (target[p]) {
            return target[p];
          }
          return (target[p] = new Subject());
        }
      }
    );
  }

  public $on(event: string, callback: (data?: any) => void) {
    this.listeners.push({
      sub: this.bus$[event].subscribe(callback),
      callback
    });
  }

  public $off(event: string, callback: (data?: any) => void) {
    const len = this.listeners.length;
    for (let i = 0; i < len; i++) {
      if (this.listeners[i].callback === callback) {
        this.listeners[i].sub.unsubscribe();
        this.listeners.splice(i, 1);
        break;
      }
    }
  }

  public $emit(event: string, data?: any) {
    this.bus$[event].next(data);
  }

  public destroyed() {
    this.listeners.forEach(listener => {
      listener.sub.unsubscribe();
    });
    this.listeners = [];
  }
}

enum Table {
  moveAnimationEnd = "Table.moveAnimationEnd",
  draggableStart = "Table.draggableStart",
  draggableEnd = "Table.draggableEnd"
}

enum Memo {
  moveAnimationEnd = "Memo.moveAnimationEnd"
}

enum ERD {
  change = "ERD.change",
  input = "ERD.input",
  contextmenuEnd = "ERD.contextmenuEnd"
}

enum ColumnDataType {
  change = "ColumnDataType.change"
}

enum DataTypeHint {
  search = "DataTypeHint.search",
  arrowUp = "DataTypeHint.arrowUp",
  arrowDown = "DataTypeHint.arrowDown",
  arrowRight = "DataTypeHint.arrowRight",
  arrowLeft = "DataTypeHint.arrowLeft"
}

enum TableList {
  search = "TableList.search"
}

export const Bus = {
  Table,
  Memo,
  ERD,
  ColumnDataType,
  DataTypeHint,
  TableList
};

export default EventBus;
