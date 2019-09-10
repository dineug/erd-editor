<template lang="pug">
  .table(
    :style="`top: ${table.ui.top}px; left: ${table.ui.left}px; width: ${table.width()}px; height: ${table.ui.height}px;`"
    @mousedown="onMousedown"
  )
    .table-header
      .table-header-top
        CircleButton.table-button(:close="true")
        CircleButton.table-button(:add="true")
      .table-header-body
        span.table-name(:style="`width: ${table.ui.widthName}px;`") {{placeholder(table.name, 'table')}}
        span.table-comment(:style="`width: ${table.ui.widthComment}px;`") {{placeholder(table.comment, 'comment')}}
    .table-body
      Column(
        v-for="column in table.columns"
        :key="column.id"
        :column="column"
      )
</template>

<script lang="ts">
  import {SIZE_TABLE_PADDING} from '@/ts/layout';
  import {Table as TableModel} from '@/store/table';
  import tableStore, {Commit} from '@/store/table';
  import canvasStore from '@/store/canvas';
  import AnimationFrame from '@/ts/AnimationFrame';
  import {Component, Prop, Vue} from 'vue-property-decorator';
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
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;
    private moveXAnimation: AnimationFrame<{x: number}> | null = null;
    private moveYAnimation: AnimationFrame<{y: number}> | null = null;

    private placeholder(value: string, display: string) {
      if (value === '') {
        return display;
      } else {
        return value;
      }
    }

    private onMousedown(event: MouseEvent) {
      this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
      this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
      if (this.moveXAnimation) {
        this.moveXAnimation.stop();
      }
      if (this.moveYAnimation) {
        this.moveYAnimation.stop();
      }
      let x = 0;
      let y = 0;
      const minWidth = canvasStore.state.width - this.table.width() - TABLE_PADDING;
      const minHeight = canvasStore.state.height - this.table.ui.height - TABLE_PADDING;
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

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      tableStore.commit(Commit.tableMove, {
        table: this.table,
        x: event.movementX,
        y: event.movementY,
      });
    }
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
          height: 100%;
        }
      }
    }
  }
</style>
