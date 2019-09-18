<template lang="pug">
  .erd(
    :style="`width: ${width}px; height: ${height}px;`"
    @mousedown="onMousedown"
  )
    Canvas(ref="canvas" :store="store")
</template>

<script lang="ts">
  import '@/plugins/fontawesome';

  import eventBus, {Bus} from '@/ts/EventBus';
  import AnimationFrame from '@/ts/AnimationFrame';
  import {Commit} from '@/store/canvas';
  import {Commit as TableCommit} from '@/store/table';
  import {Commit as MemoCommit} from '@/store/memo';
  import {log, addSpanText, removeSpanText} from '@/ts/util';
  import Key from '@/models/Key';
  import StoreManagement from '@/store/StoreManagement';
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

    private store: StoreManagement = new StoreManagement();

    @Watch('focus')
    private watchFocus(focus: boolean) {
      log.debug(`ERD watchFocus: ${focus}`);
      this.store.canvasStore.commit(Commit.focus, focus);
    }

    @Watch('value')
    private watchValue(value: string) {
      if (value.trim() === '') {
        this.store.init();
        this.$emit('change', this.store.value());
      } else {
        this.store.load(value);
      }
    }

    // ==================== Event Handler ===================
    private onChange() {
      log.debug('ERD onChange');
      this.$emit('change', this.store.value());
    }

    private onInput() {
      log.debug('ERD onInput');
      this.$emit('input', this.store.value());
    }

    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd') && !el.closest('.table') && !el.closest('.memo')) {
        this.onMouseStop();
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
        this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
        this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
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
      const minWidth = this.width - this.store.canvasStore.state.width;
      const minHeight = this.height - this.store.canvasStore.state.height;
      let x = 0;
      let y = 0;
      if (this.store.canvasStore.state.x < minWidth) {
        x = minWidth;
      }
      if (this.store.canvasStore.state.y < minHeight) {
        y = minHeight;
      }

      if (this.store.canvasStore.state.x > 0 || this.store.canvasStore.state.x < minWidth) {
        this.moveXAnimation = new AnimationFrame(
          {x: this.store.canvasStore.state.x},
          {x}, 200)
          .update((value) => this.store.canvasStore.state.x = value.x)
          .start();
      }

      if (this.store.canvasStore.state.y > 0 || this.store.canvasStore.state.y < minHeight) {
        this.moveYAnimation = new AnimationFrame(
          {y: this.store.canvasStore.state.y},
          {y}, 200)
          .update((value) => this.store.canvasStore.state.y = value.y)
          .start();
      }
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      this.store.canvasStore.commit(Commit.move, {
        x: event.movementX,
        y: event.movementY,
      });
    }

    private onKeydown(event: KeyboardEvent) {
      log.debug('ERD onKeydown');
      if (this.focus) {
        if (event.altKey && event.code === Key.KeyN) {
          this.store.tableStore.commit(TableCommit.tableAdd, this.store);
        } else if (event.altKey && event.code === Key.KeyM) {
          this.store.memoStore.commit(MemoCommit.memoAdd, this.store);
        } else if (event.altKey && event.key === Key.Enter) {
          this.store.tableStore.commit(TableCommit.columnAddAll, this.store);
        } else if (event.ctrlKey && event.code === Key.KeyA) {
          event.preventDefault();
          this.store.tableStore.commit(TableCommit.tableSelectAll);
          this.store.memoStore.commit(MemoCommit.memoSelectAll);
        } else if (event.ctrlKey && event.key === Key.Delete) {
          this.store.tableStore.commit(TableCommit.tableRemoveAll);
          this.store.memoStore.commit(MemoCommit.memoRemoveAll);
        } else if (event.altKey && event.key === Key.Delete) {
          this.store.tableStore.commit(TableCommit.columnRemoveAll);
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
      this.store.canvasStore.commit(Commit.focus, this.focus);
      eventBus.$on(Bus.ERD.change, this.onChange);
      eventBus.$on(Bus.ERD.input, this.onInput);
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
      eventBus.$off(Bus.ERD.change, this.onChange);
      eventBus.$off(Bus.ERD.input, this.onInput);
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
