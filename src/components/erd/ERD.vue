<template lang="pug">
  .erd(
    :style="`width: ${width}px; height: ${height}px;`"
    @mousedown="onMousedown"
  )
    Canvas(ref="canvas" :store="store" :focus="focus")
</template>

<script lang="ts">
  import '@/plugins/fontawesome';

  import eventBus, {Bus} from '@/ts/EventBus';
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

    private store: StoreManagement = new StoreManagement();

    private currentValue: string = '';

    @Watch('value')
    private watchValue(value: string) {
      log.debug('ERD watchValue');
      if (value.trim() === '') {
        this.store.init();
        this.currentValue = this.store.value;
        this.$emit('change', this.currentValue);
      } else if (this.currentValue !== value) {
        this.store.load(value);
      }
    }

    // ==================== Event Handler ===================
    private onChange() {
      log.debug('ERD onChange');
      this.currentValue = this.store.value;
      this.$emit('change', this.currentValue);
    }

    private onInput() {
      log.debug('ERD onInput');
      this.currentValue = this.store.value;
      this.$emit('input', this.currentValue);
    }

    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd') && !el.closest('.table') && !el.closest('.memo')) {
        this.onMouseup(event);
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
        this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
        this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
      }
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      this.$el.scrollTop -= event.movementY;
      this.$el.scrollLeft -= event.movementX;
      this.store.canvasStore.commit(Commit.move, {
        scrollTop: this.$el.scrollTop,
        scrollLeft: this.$el.scrollLeft,
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
    overflow: hidden;
  }
</style>
