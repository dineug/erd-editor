import StoreManagement from '@/store/StoreManagement';
import Menu from '@/models/Menu';
import {Commit as TableCommit} from '@/store/table';
import {Commit as MemoCommit} from '@/store/memo';
import {Commit as RelationshipCommit, RelationshipType} from '@/store/relationship';
import {ShowKey} from '@/store/canvas';
import {Bus} from '@/ts/EventBus';
import icon from '@/ts/icon';
import {uuid} from '@/ts/util';

function dataMenu(store: StoreManagement): Menu[] {
  const show = store.canvasStore.state.show;
  return [
    {
      id: uuid(),
      name: 'New Table',
      keymap: 'Alt + N',
      icon: 'table',
      execute() {
        store.tableStore.commit(TableCommit.tableAdd, store);
      },
    },
    {
      id: uuid(),
      name: 'New Memo',
      keymap: 'Alt + M',
      icon: 'sticky-note',
      execute() {
        store.memoStore.commit(MemoCommit.memoAdd, store);
      },
    },
    {
      id: uuid(),
      name: 'Primary Key',
      keymap: 'Alt + K',
      icon: 'key',
      execute() {
        store.tableStore.commit(TableCommit.columnPrimaryKey);
      },
    },
    {
      id: uuid(),
      name: '1 : 1',
      keymap: 'Alt + 1',
      icon: icon[RelationshipType.ZeroOne],
      base64: true,
      execute() {
        store.relationshipStore.commit(RelationshipCommit.relationshipEditStart, {
          store,
          relationshipType: RelationshipType.ZeroOne,
        });
      },
    },
    {
      id: uuid(),
      name: '1 : N',
      keymap: 'Alt + 2',
      icon: icon[RelationshipType.ZeroOneN],
      base64: true,
      execute() {
        store.relationshipStore.commit(RelationshipCommit.relationshipEditStart, {
          store,
          relationshipType: RelationshipType.ZeroOneN,
        });
      },
    },
    {
      id: uuid(),
      name: 'View Option',
      children: [
        {
          id: uuid(),
          icon: show.tableComment ? 'check' : undefined,
          name: 'Table Comment',
          execute() {
            show.tableComment = !show.tableComment;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.tableComment},
        },
        {
          id: uuid(),
          icon: show.columnComment ? 'check' : undefined,
          name: 'Column Comment',
          execute() {
            show.columnComment = !show.columnComment;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnComment},
        },
        {
          id: uuid(),
          icon: show.columnDataType ? 'check' : undefined,
          name: 'DataType',
          execute() {
            show.columnDataType = !show.columnDataType;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnDataType},
        },
        {
          id: uuid(),
          icon: show.columnNotNull ? 'check' : undefined,
          name: 'Not Null',
          execute() {
            show.columnNotNull = !show.columnNotNull;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnNotNull},
        },
        {
          id: uuid(),
          icon: show.columnDefault ? 'check' : undefined,
          name: 'Default',
          execute() {
            show.columnDefault = !show.columnDefault;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnDefault},
        },
        {
          id: uuid(),
          icon: show.columnAutoIncrement ? 'check' : undefined,
          name: 'AutoIncrement',
          execute() {
            show.columnAutoIncrement = !show.columnAutoIncrement;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnAutoIncrement},
        },
        {
          id: uuid(),
          icon: show.columnPrimaryKey ? 'check' : undefined,
          name: 'PrimaryKey',
          execute() {
            show.columnPrimaryKey = !show.columnPrimaryKey;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnPrimaryKey},
        },
        {
          id: uuid(),
          icon: show.columnUnique ? 'check' : undefined,
          name: 'Unique',
          execute() {
            show.columnUnique = !show.columnUnique;
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: {close: false, show: ShowKey.columnUnique},
        },
        {
          id: uuid(),
          icon: show.relationship ? 'check' : undefined,
          name: 'Relationship',
          execute() {
            show.relationship = !show.relationship;
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
