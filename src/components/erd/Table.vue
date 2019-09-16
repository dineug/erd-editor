<template lang="pug">
  .table(
    :class="{active: table.ui.active}"
    :style="tableStyle"
    @mousedown="onMousedown"
  )
    .table-header
      .table-header-top
        CircleButton.table-button(:close="true" @click="onClose")
        CircleButton.table-button(:add="true" @click="onColumnAdd")
      .table-header-body
        span.table-name(
          :class="{focus: focusName, placeholder: placeholderName}"
          :style="`width: ${table.ui.widthName}px;`"
          @mousedown="onFocus($event, 'tableName')"
        ) {{placeholder(table.name, 'table')}}
        span.table-comment(
          v-if="show.tableComment"
          :class="{focus: focusComment, placeholder: placeholderComment}"
          :style="`width: ${table.ui.widthComment}px;`"
          @mousedown="onFocus($event, 'tableComment')"
        ) {{placeholder(table.comment, 'comment')}}
    .table-body
      Column(
        v-for="(column, index) in table.columns"
        :key="column.id"
        :table="table"
        :column="column"
        :columnFocus="columnFocus(index)"
      )
</template>

<script lang="ts">
  import {SIZE_TABLE_PADDING} from '@/ts/layout';
  import {Table as TableModel} from '@/store/table';
  import tableStore, {Commit} from '@/store/table';
  import canvasStore, {Show} from '@/store/canvas';
  import {FocusType} from '@/models/TableFocusModel';
  import {ColumnFocus} from '@/models/ColumnFocusModel';
  import AnimationFrame from '@/ts/AnimationFrame';
  import eventBus, {Bus} from '@/ts/EventBus';
  import {log} from '@/ts/util';
  import {Component, Prop, Watch, Vue} from 'vue-property-decorator';
  import Column from './Table/Column.vue';
  import CircleButton from './CircleButton.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  const TABLE_PADDING = SIZE_TABLE_PADDING * 2;

  @Component({
    components: {
      Column,
      CircleButton,
    },
  })
  export default class Table extends Vue {
    @Prop({type: Object, default: () => ({})})
    private table!: TableModel;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private keydown$: Observable<KeyboardEvent> = fromEvent<KeyboardEvent>(window, 'keydown');
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;
    private subKeydown: Subscription | null = null;

    private moveXAnimation: AnimationFrame<{ x: number }> | null = null;
    private moveYAnimation: AnimationFrame<{ y: number }> | null = null;

    get tableStyle(): string {
      return `
        top: ${this.table.ui.top}px;
        left: ${this.table.ui.left}px;
        width: ${this.table.width()}px;
        height: ${this.table.height()}px;
        z-index: ${this.table.ui.zIndex};
      `;
    }

    get focus(): boolean {
      let result = false;
      if (tableStore.state.tableFocus && tableStore.state.tableFocus.id === this.table.id) {
        result = true;
      }
      return result;
    }

    get focusName(): boolean {
      let result = false;
      if (tableStore.state.tableFocus
        && tableStore.state.tableFocus.id === this.table.id
        && tableStore.state.tableFocus.focusName) {
        result = true;
      }
      return result;
    }

    get focusComment(): boolean {
      let result = false;
      if (tableStore.state.tableFocus
        && tableStore.state.tableFocus.id === this.table.id
        && tableStore.state.tableFocus.focusComment) {
        result = true;
      }
      return result;
    }

    get placeholderName(): boolean {
      let result = false;
      if (this.table.name === '') {
        result = true;
      }
      return result;
    }

    get placeholderComment(): boolean {
      let result = false;
      if (this.table.name === '') {
        result = true;
      }
      return result;
    }

    get show(): Show {
      return canvasStore.state.show;
    }

    @Watch('focus')
    private watchFocus(value: boolean) {
      log.debug('Table watchFocus');
      if (value) {
        if (this.subKeydown) {
          this.subKeydown.unsubscribe();
        }
        this.subKeydown = this.keydown$.subscribe(this.onKeydown);
      } else {
        if (this.subKeydown) {
          this.subKeydown.unsubscribe();
        }
      }
    }

    @Watch('table.columns')
    private watchColumns() {
      log.debug('Table watchColumns');
      if (tableStore.state.tableFocus && tableStore.state.tableFocus.id === this.table.id) {
        tableStore.state.tableFocus.watchColumns();
      }
    }

    private placeholder(value: string, display: string) {
      if (value === '') {
        return display;
      } else {
        return value;
      }
    }

    private columnFocus(index: number): ColumnFocus | null {
      let result: ColumnFocus | null = null;
      if (tableStore.state.tableFocus
        && tableStore.state.tableFocus.id === this.table.id) {
        result = tableStore.state.tableFocus.focusColumns[index];
      }
      return result;
    }

    // ==================== Event Handler ===================
    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.table-button')) {
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
      }
      if (!el.closest('.table-name')
        && !el.closest('.table-comment')
        && !el.closest('.column')) {
        tableStore.commit(Commit.tableSelect, {
          table: this.table,
          event,
        });
      }
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
      eventBus.$emit(Bus.Table.moveAnimationEnd);
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      tableStore.commit(Commit.tableMove, {
        table: this.table,
        x: event.movementX,
        y: event.movementY,
        event,
      });
    }

    private onClose() {
      tableStore.commit(Commit.tableRemove, this.table);
    }

    private onMoveAnimationEnd() {
      if (this.moveXAnimation) {
        this.moveXAnimation.stop();
      }
      if (this.moveYAnimation) {
        this.moveYAnimation.stop();
      }
      let x = 0;
      let y = 0;
      const minWidth = canvasStore.state.width - this.table.width() - TABLE_PADDING;
      const minHeight = canvasStore.state.height - this.table.height() - TABLE_PADDING;
      if (this.table.ui.left > minWidth) {
        x = minWidth;
      }
      if (this.table.ui.top > minHeight) {
        y = minHeight;
      }
      if (this.table.ui.left < 0 || this.table.ui.left > minWidth) {
        this.moveXAnimation = new AnimationFrame(
          {x: this.table.ui.left},
          {x}, 200)
          .update((value) => this.table.ui.left = value.x)
          .start();
      }
      if (this.table.ui.top < 0 || this.table.ui.top > minHeight) {
        this.moveYAnimation = new AnimationFrame(
          {y: this.table.ui.top},
          {y}, 200)
          .update((value) => this.table.ui.top = value.y)
          .start();
      }
    }

    private onKeydown(event: KeyboardEvent) {
      log.debug('Table onKeydown');
      tableStore.commit(Commit.tableFocusMove, event);
    }

    private onFocus(event: MouseEvent, focusType: FocusType) {
      log.debug('Table onFocus');
      tableStore.commit(Commit.tableSelect, {
        table: this.table,
        event,
      });
      if (this.focus) {
        tableStore.commit(Commit.tableFocus, focusType);
      }
    }

    private onColumnAdd() {
      log.debug('Table onColumnAdd');
      tableStore.commit(Commit.columnAdd, this.table);
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private created() {
      eventBus.$on(Bus.Table.moveAnimationEnd, this.onMoveAnimationEnd);
    }

    private destroyed() {
      eventBus.$off(Bus.Table.moveAnimationEnd, this.onMoveAnimationEnd);
    }

    // ==================== Life Cycle END ====================
  }
</script>

<style scoped lang="scss">
  .table {
    position: absolute;
    z-index: 300;
    background-color: $color-table;
    opacity: 0.9;
    padding: $size-table-padding;
    font-size: $size-font + 2;

    &.active {
      border: solid $color-table-active 1px;
      box-shadow: 0 1px 6px $color-table-active;
    }

    .table-header {

      .table-header-top {
        overflow: hidden;

        .table-button {
          margin-left: 5px;
          float: right;
        }
      }

      .table-header-body {
        height: $size-table-header-height;

        .table-name, .table-comment {
          display: inline-flex;
          align-items: center;
          margin-right: $size-margin-right;
          border-bottom: solid $color-opacity $size-border-bottom;

          &.focus {
            border-bottom: solid $color-focus $size-border-bottom;
          }

          &.placeholder {
            color: $color-font-placeholder;
          }
        }
      }
    }
  }
</style>
