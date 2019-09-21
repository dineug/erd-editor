<template lang="pug">
  svg.drag(:style="dragStyle")
    rect(
      :width="width"
      :height="height"
      stroke="#0098ff"
      stroke-width="1"
      stroke-opacity="0.9"
      stroke-dasharray="3"
      fill-opacity="0.3"
    )
</template>

<script lang="ts">
  import StoreManagement from '@/store/StoreManagement';
  import {Commit as TableCommit} from '@/store/table';
  import {Commit as MemoCommit} from '@/store/memo';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  const MARGIN = 4;

  @Component
  export default class MultipleSelect extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Number, default: 0})
    private x!: number;
    @Prop({type: Number, default: 0})
    private y!: number;
    @Prop({type: Number, default: 0})
    private ghostX!: number;
    @Prop({type: Number, default: 0})
    private ghostY!: number;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private mousemoveParent$!: Observable<MouseEvent>;
    private subMouseup!: Subscription;
    private subMousemove!: Subscription;
    private subMousemoveParent!: Subscription;

    private top: number = 0;
    private left: number = 0;
    private width: number = 0;
    private height: number = 0;

    get dragStyle(): string {
      return `
        top: ${this.top}px;
        left: ${this.left}px;
        width: ${this.width}px;
        height: ${this.height}px;
      `;
    }

    // ==================== Event Handler ===================
    private onMouseup(event: MouseEvent) {
      this.$emit('selectEnd');
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      if (!event.ctrlKey) {
        this.$emit('selectEnd');
      }
    }

    private onMousemoveParent(event: MouseEvent) {
      const currentX = event.x;
      const currentY = event.y;
      const currentMinX = this.x > currentX;
      const currentMinY = this.y > currentY;
      const min = {
        x: this.x < currentX ? this.x : currentX,
        y: this.y < currentY ? this.y : currentY,
      };
      const max = {
        x: this.x > currentX ? this.x : currentX,
        y: this.y > currentY ? this.y : currentY,
      };
      if (currentMinX) {
        this.left = min.x + MARGIN;
        this.width = max.x - min.x;
      } else {
        this.left = min.x;
        this.width = max.x - min.x - MARGIN;
        if (this.width < 0) {
          this.width = 0;
        }
      }
      if (currentMinY) {
        this.top = min.y + MARGIN;
        this.height = max.y - min.y;
      } else {
        this.top = min.y;
        this.height = max.y - min.y - MARGIN;
        if (this.height < 0) {
          this.height = 0;
        }
      }

      const ghostCurrentX = event.offsetX;
      const ghostCurrentY = event.offsetY;
      const ghostMin = {
        x: this.ghostX < ghostCurrentX ? this.ghostX : ghostCurrentX,
        y: this.ghostY < ghostCurrentY ? this.ghostY : ghostCurrentY,
      };
      const ghostMax = {
        x: this.ghostX > ghostCurrentX ? this.ghostX : ghostCurrentX,
        y: this.ghostY > ghostCurrentY ? this.ghostY : ghostCurrentY,
      };
      this.store.tableStore.commit(TableCommit.tableMultipleSelect, {
        min: ghostMin,
        max: ghostMax,
      });
      this.store.memoStore.commit(MemoCommit.memoMultipleSelect, {
        min: ghostMin,
        max: ghostMax,
      });
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private mounted() {
      this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
      this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
      if (this.$el.parentElement) {
        this.mousemoveParent$ = fromEvent<MouseEvent>(this.$el.parentElement, 'mousemove');
        this.subMousemoveParent = this.mousemoveParent$.subscribe(this.onMousemoveParent);
      }
    }

    private destroyed() {
      this.subMouseup.unsubscribe();
      this.subMousemove.unsubscribe();
      this.subMousemoveParent.unsubscribe();
    }

    // ==================== Life Cycle END ====================

  }
</script>

<style scoped lang="scss">
  .drag {
    position: fixed;
    z-index: 7500;
  }
</style>
