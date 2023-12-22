import { observable } from '@/core';

export interface Todo {
  name: string;
}

export class Store {
  list: Todo[] = observable([]);

  add(todo: Todo) {
    this.list.push(todo);
  }
}
