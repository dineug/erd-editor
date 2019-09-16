<template lang="pug">
  .erd(
    :style="`width: ${width}px; height: ${height}px;`"
    @mousedown="onMousedown"
  )
    Canvas(ref="canvas")
</template>

<script lang="ts">
  import '@/plugins/fontawesome';

  import eventBus from '@/ts/EventBus';
  import AnimationFrame from '@/ts/AnimationFrame';
  import canvasStore, {Commit} from '@/store/canvas';
  import tableStore, {Commit as TableCommit} from '@/store/table';
  import {log, addSpanText, removeSpanText} from '@/ts/util';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Canvas from './Canvas.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  @Component({
    components: {
      Canvas,
    },
  })
  export default class ERD extends Vue {
    @Prop({type: String, default: ''})
    private value!: string;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;
    private moveXAnimation: AnimationFrame<{x: number}> | null = null;
    private moveYAnimation: AnimationFrame<{y: number}> | null = null;

    // ==================== Event Handler ===================
    private onChange() {
      // this.$emit('change', '');
    }

    private onInput() {
      // this.$emit('input', '');
    }

    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd') && !el.closest('.table')) {
        this.onMouseStop();
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
        tableStore.commit(TableCommit.tableSelectAllEnd);
      }
    }

    private onMouseStop() {
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
    }

    private onMouseup(event: MouseEvent) {
      this.onMouseStop();
      const minWidth = this.width - canvasStore.state.width;
      const minHeight = this.height - canvasStore.state.height;
      let x = 0;
      let y = 0;
      if (canvasStore.state.x < minWidth) {
        x = minWidth;
      }
      if (canvasStore.state.y < minHeight) {
        y = minHeight;
      }

      if (canvasStore.state.x > 0 || canvasStore.state.x < minWidth) {
        this.moveXAnimation = new AnimationFrame(
          {x: canvasStore.state.x},
          {x}, 200)
          .update((value) => canvasStore.state.x = value.x)
          .start();
      }

      if (canvasStore.state.y > 0 || canvasStore.state.y < minHeight) {
        this.moveYAnimation = new AnimationFrame(
          {y: canvasStore.state.y},
          {y}, 200)
          .update((value) => canvasStore.state.y = value.y)
          .start();
      }
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      canvasStore.commit(Commit.move, {
        x: event.movementX,
        y: event.movementY,
      });
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private created() {
      if (process.env.NODE_ENV === 'development') {
        eventBus.destroyed();
      }
    }

    private mounted() {
      addSpanText();
    }

    private destroyed() {
      removeSpanText();
    }

    // ==================== Life Cycle END ====================
  }
</script>

<style scoped lang="scss">
  .erd {
    position: absolute;
    z-index: 100;
  }
</style>
