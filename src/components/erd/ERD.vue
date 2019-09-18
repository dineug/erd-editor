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
  import memoStore, {Commit as MemoCommit} from '@/store/memo';
  import {log, addSpanText, removeSpanText} from '@/ts/util';
  import Key from '@/models/Key';
  import {Component, Prop, Watch, Vue} from 'vue-property-decorator';
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
    @Prop({type: Boolean, default: false})
    private focus!: boolean;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private keydown$: Observable<KeyboardEvent> = fromEvent<KeyboardEvent>(window, 'keydown');
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;
    private subKeydown!: Subscription;

    private moveXAnimation: AnimationFrame<{x: number}> | null = null;
    private moveYAnimation: AnimationFrame<{y: number}> | null = null;

    @Watch('focus')
    private watchFocus(focus: boolean) {
      log.debug(`ERD watchFocus: ${focus}`);
      canvasStore.commit(Commit.focus, focus);
    }

    // ==================== Event Handler ===================
    private onChange() {
      // this.$emit('change', '');
    }

    private onInput() {
      // this.$emit('input', '');
    }

    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd') && !el.closest('.table') && !el.closest('.memo')) {
        this.onMouseStop();
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
        tableStore.commit(TableCommit.tableSelectAllEnd);
        memoStore.commit(MemoCommit.memoSelectAllEnd);
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

    private onKeydown(event: KeyboardEvent) {
      log.debug('ERD onKeydown');
      if (this.focus) {
        if (event.altKey && event.code === Key.KeyN) {
          tableStore.commit(TableCommit.tableAdd);
        } else if (event.altKey && event.code === Key.KeyM) {
          memoStore.commit(MemoCommit.memoAdd);
        } else if (event.altKey && event.key === Key.Enter) {
          tableStore.commit(TableCommit.columnAddAll);
        } else if (event.ctrlKey && event.code === Key.KeyA) {
          event.preventDefault();
          tableStore.commit(TableCommit.tableSelectAll);
          memoStore.commit(MemoCommit.memoSelectAll);
        } else if (event.ctrlKey && event.key === Key.Delete) {
          tableStore.commit(TableCommit.tableRemoveAll);
          memoStore.commit(MemoCommit.memoRemoveAll);
        } else if (event.altKey && event.key === Key.Delete) {
          tableStore.commit(TableCommit.columnRemoveAll);
        }
      }
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private created() {
      log.debug('ERD created');
      if (process.env.NODE_ENV === 'development') {
        eventBus.destroyed();
      }
      canvasStore.commit(Commit.focus, this.focus);
    }

    private mounted() {
      log.debug('ERD mounted');
      addSpanText();
      this.subKeydown = this.keydown$.subscribe(this.onKeydown);
    }

    private destroyed() {
      log.debug('ERD destroyed');
      removeSpanText();
      this.subKeydown.unsubscribe();
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
