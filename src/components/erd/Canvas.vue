<template lang="pug">
  .canvas(:style="`width: ${option.width}px; height: ${option.height}px;`")
    Contextmenu.contextmenu-erd(
      v-if="contextmenu"
      :store="store"
      :menus="menus"
      :x="contextmenuX"
      :y="contextmenuY"
    )
    Table(
      v-for="table in tables"
      :key="table.id"
      :store="store"
      :focus="focus"
      :table="table"
    )
    Memo(
      v-for="memo in memos"
      :key="memo.id"
      :store="store"
      :memo="memo"
    )
</template>

<script lang="ts">
  import {State, ShowKey} from '@/store/canvas';
  import {Table as TableModel, Commit as TableCommit} from '@/store/table';
  import {Memo as MemoModel, Commit as MemoCommit} from '@/store/memo';
  import {log, uuid} from '@/ts/util';
  import StoreManagement from '@/store/StoreManagement';
  import {Bus} from '@/ts/EventBus';
  import Menu from '@/models/Menu';
  import icon from '@/ts/icon';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Table.vue';
  import Memo from './Memo.vue';
  import Relationship from './Relationship.vue';
  import Contextmenu from './Contextmenu.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
      Contextmenu,
    },
  })
  export default class Canvas extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Boolean, default: false})
    private focus!: boolean;

    private mousedown$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousedown');
    private subMousedown!: Subscription;
    private subContextmenu!: Subscription;
    private contextmenu: boolean = false;
    private contextmenuX: number = 0;
    private contextmenuY: number = 0;

    private menus: Menu[] = [
      {
        id: uuid(),
        name: 'New Table',
        keymap: 'Alt + N',
        icon: 'table',
        execute: () => {
          this.store.tableStore.commit(TableCommit.tableAdd, this.store);
        },
      },
      {
        id: uuid(),
        name: 'New Memo',
        keymap: 'Alt + M',
        icon: 'sticky-note',
        execute: () => {
          this.store.memoStore.commit(MemoCommit.memoAdd, this.store);
        },
      },
      {
        id: uuid(),
        name: 'Primary Key',
        keymap: 'Alt + K',
        icon: 'key',
        execute: () => {
          log.debug('Primary Key');
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
            icon: this.option.show.tableComment ? 'check' : undefined,
            name: 'Table Comment',
            execute: () => {
              this.option.show.tableComment = !this.option.show.tableComment;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.tableComment},
          },
          {
            id: uuid(),
            icon: this.option.show.columnComment ? 'check' : undefined,
            name: 'Column Comment',
            execute: () => {
              this.option.show.columnComment = !this.option.show.columnComment;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnComment},
          },
          {
            id: uuid(),
            icon: this.option.show.columnDataType ? 'check' : undefined,
            name: 'DataType',
            execute: () => {
              this.option.show.columnDataType = !this.option.show.columnDataType;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnDataType},
          },
          {
            id: uuid(),
            icon: this.option.show.columnNotNull ? 'check' : undefined,
            name: 'Not Null',
            execute: () => {
              this.option.show.columnNotNull = !this.option.show.columnNotNull;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnNotNull},
          },
          {
            id: uuid(),
            icon: this.option.show.columnDefault ? 'check' : undefined,
            name: 'Default',
            execute: () => {
              this.option.show.columnDefault = !this.option.show.columnDefault;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnDefault},
          },
          {
            id: uuid(),
            icon: this.option.show.columnAutoIncrement ? 'check' : undefined,
            name: 'AutoIncrement',
            execute: () => {
              this.option.show.columnAutoIncrement = !this.option.show.columnAutoIncrement;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnAutoIncrement},
          },
          {
            id: uuid(),
            icon: this.option.show.columnPrimaryKey ? 'check' : undefined,
            name: 'PrimaryKey',
            execute: () => {
              this.option.show.columnPrimaryKey = !this.option.show.columnPrimaryKey;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnPrimaryKey},
          },
          {
            id: uuid(),
            icon: this.option.show.columnUnique ? 'check' : undefined,
            name: 'Unique',
            execute: () => {
              this.option.show.columnUnique = !this.option.show.columnUnique;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.columnUnique},
          },
          {
            id: uuid(),
            icon: this.option.show.relationship ? 'check' : undefined,
            name: 'Relationship',
            execute: () => {
              this.option.show.relationship = !this.option.show.relationship;
              this.store.eventBus.$emit(Bus.ERD.change);
            },
            option: {close: false, show: ShowKey.relationship},
          },
        ],
      },
    ];

    get option(): State {
      return this.store.canvasStore.state;
    }

    get tables(): TableModel[] {
      return this.store.tableStore.state.tables;
    }

    get memos(): MemoModel[] {
      return this.store.memoStore.state.memos;
    }

    // ==================== Event Handler ===================
    private onMousedown(event: MouseEvent) {
      log.debug('Canvas onMousedown');
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd')) {
        this.contextmenu = false;
      }
    }

    private onContextmenu(event: MouseEvent) {
      log.debug('Canvas onContextmenu');
      event.preventDefault();
      const el = event.target as HTMLElement;
      this.contextmenu = !!el.closest('.canvas');
      if (this.contextmenu) {
        this.contextmenuX = event.x;
        this.contextmenuY = event.y;
      }
    }

    private onContextmenuEnd() {
      this.contextmenu = false;
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private mounted() {
      this.subMousedown = this.mousedown$.subscribe(this.onMousedown);
      this.subContextmenu = fromEvent<MouseEvent>(this.$el, 'contextmenu').subscribe(this.onContextmenu);
      this.store.eventBus.$on(Bus.Canvas.contextmenuEnd, this.onContextmenuEnd);
    }

    private destroyed() {
      this.subMousedown.unsubscribe();
      this.subContextmenu.unsubscribe();
      this.store.eventBus.$off(Bus.Canvas.contextmenuEnd, this.onContextmenuEnd);
    }

    // ==================== Life Cycle END ====================
  }
</script>

<style scoped lang="scss">
  .canvas {
    position: relative;
    z-index: 200;
    background-color: $color-canvas;
  }
</style>
