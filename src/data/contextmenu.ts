import StoreManagement from '@/store/StoreManagement';
import Menu from '@/models/Menu';
import {Commit as TableCommit} from '@/store/table';
import {Commit as MemoCommit} from '@/store/memo';
import {ShowKey} from '@/store/canvas';
import {Bus} from '@/ts/EventBus';
import icon from '@/ts/icon';
import {log, uuid} from '@/ts/util';

function dataMenu(store: StoreManagement): Menu[] {
  return [
    {
      id: uuid(),
      name: 'New Table',
      keymap: 'Alt + N',
      icon: 'table',
      execute: () => {
        store.tableStore.commit(TableCommit.tableAdd, store);
      },
    },
    {
      id: uuid(),
      name: 'New Memo',
      keymap: 'Alt + M',
      icon: 'sticky-note',
      execute: () => {
        store.memoStore.commit(MemoCommit.memoAdd, store);
      },
    },
    {
      id: uuid(),
      name: 'Primary Key',
      keymap: 'Alt + K',
      icon: 'key',
      execute: () => {
        store.tableStore.commit(TableCommit.columnPrimaryKey);
      },
    },
    {
      id: uuid(),
      name: '1 : 1',
      keymap: 'Alt + 1',
      icon: icon['erd-0-1'],
      base64: true,
      execute: () => {
        log.debug('1 : 1');
      },
    },
    {
      id: uuid(),
      name: '1 : N',
      keymap: 'Alt + 2',
      icon: icon['erd-0-1-N'],
      base64: true,
      execute: () => {
        log.debug('1 : N');
      },
    },
    {
      id: uuid(),
      name: 'View Option',
      children: [
        {
          id: uuid(),
          icon: store.canvasStore.state.show.tableComment ? 'check' : undefined,
          name: 'Table Comment',
          execute: () => {
            store.canvasStore.state.show.tableComment = !store.canvasStore.state.show.tableComment;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.tableComment},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnComment ? 'check' : undefined,
          name: 'Column Comment',
          execute: () => {
            store.canvasStore.state.show.columnComment = !store.canvasStore.state.show.columnComment;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnComment},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnDataType ? 'check' : undefined,
          name: 'DataType',
          execute: () => {
            store.canvasStore.state.show.columnDataType = !store.canvasStore.state.show.columnDataType;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnDataType},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnNotNull ? 'check' : undefined,
          name: 'Not Null',
          execute: () => {
            store.canvasStore.state.show.columnNotNull = !store.canvasStore.state.show.columnNotNull;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnNotNull},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnDefault ? 'check' : undefined,
          name: 'Default',
          execute: () => {
            store.canvasStore.state.show.columnDefault = !store.canvasStore.state.show.columnDefault;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnDefault},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnAutoIncrement ? 'check' : undefined,
          name: 'AutoIncrement',
          execute: () => {
            store.canvasStore.state.show.columnAutoIncrement = !store.canvasStore.state.show.columnAutoIncrement;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnAutoIncrement},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnPrimaryKey ? 'check' : undefined,
          name: 'PrimaryKey',
          execute: () => {
            store.canvasStore.state.show.columnPrimaryKey = !store.canvasStore.state.show.columnPrimaryKey;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnPrimaryKey},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.columnUnique ? 'check' : undefined,
          name: 'Unique',
          execute: () => {
            store.canvasStore.state.show.columnUnique = !store.canvasStore.state.show.columnUnique;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnUnique},
        },
        {
          id: uuid(),
          icon: store.canvasStore.state.show.relationship ? 'check' : undefined,
          name: 'Relationship',
          execute: () => {
            store.canvasStore.state.show.relationship = !store.canvasStore.state.show.relationship;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.relationship},
        },
      ],
    },
  ];
}

export {
  dataMenu,
};
