<template lang="pug">
  .memo(
    :class="{active: memo.ui.active}"
    :style="memoStyle"
    @mousedown="onMousedown"
  )
    .memo-header
      CircleButton.memo-button(
        title="Ctrl + Delete"
        close
        @click="onClose"
      )
    .memo-body
      textarea(
        :style="textareaStyle"
        v-model="memo.value"
        spellcheck="false"
      )
    .memo-footer

</template>

<script lang="ts">
  import {SIZE_MEMO_PADDING} from '@/ts/layout';
  import memoStore, {Memo as MemoModel, Commit} from '@/store/memo';
  import canvasStore, {Show} from '@/store/canvas';
  import eventBus, {Bus} from '@/ts/EventBus';
  import {log} from '@/ts/util';
  import AnimationFrame from '@/ts/AnimationFrame';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import CircleButton from './CircleButton.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
  const MEMO_HEADER = 17 + SIZE_MEMO_PADDING;

  @Component({
    components: {
      CircleButton,
    },
  })
  export default class Memo extends Vue {
    @Prop({type: Object, default: () => ({})})
    private memo!: MemoModel;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;

    private moveXAnimation: AnimationFrame<{ x: number }> | null = null;
    private moveYAnimation: AnimationFrame<{ y: number }> | null = null;

    get memoStyle(): string {
      return `
        top: ${this.memo.ui.top}px;
        left: ${this.memo.ui.left}px;
        width: ${this.memo.ui.width + MEMO_PADDING}px;
        height: ${this.memo.ui.height + MEMO_PADDING + MEMO_HEADER}px;
        z-index: ${this.memo.ui.zIndex};
      `;
    }

    get textareaStyle(): string {
      return `
        width: ${this.memo.ui.width}px;
        height: ${this.memo.ui.height}px;
      `;
    }

    // ==================== Event Handler ===================
    private onMousedown(event: MouseEvent) {
      log.debug('Memo onMousedown');
      const el = event.target as HTMLElement;
      if (!el.closest('.memo-button')) {
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
      }
      memoStore.commit(Commit.memoSelect, {
        memo: this.memo,
        event,
      });
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
      eventBus.$emit(Bus.Memo.moveAnimationEnd);
      eventBus.$emit(Bus.Table.moveAnimationEnd);
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      memoStore.commit(Commit.memoMove, {
        memo: this.memo,
        x: event.movementX,
        y: event.movementY,
        event,
      });
    }

    private onClose() {
      log.debug('Memo onClose');
      memoStore.commit(Commit.memoRemove, this.memo);
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
      const minWidth = canvasStore.state.width - (this.memo.ui.width + MEMO_PADDING);
      const minHeight = canvasStore.state.height - (this.memo.ui.height + MEMO_PADDING + MEMO_HEADER);
      if (this.memo.ui.left > minWidth) {
        x = minWidth;
      }
      if (this.memo.ui.top > minHeight) {
        y = minHeight;
      }
      if (this.memo.ui.left < 0 || this.memo.ui.left > minWidth) {
        this.moveXAnimation = new AnimationFrame(
          {x: this.memo.ui.left},
          {x}, 200)
          .update((value) => this.memo.ui.left = value.x)
          .start();
      }
      if (this.memo.ui.top < 0 || this.memo.ui.top > minHeight) {
        this.moveYAnimation = new AnimationFrame(
          {y: this.memo.ui.top},
          {y}, 200)
          .update((value) => this.memo.ui.top = value.y)
          .start();
      }
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private created() {
      eventBus.$on(Bus.Memo.moveAnimationEnd, this.onMoveAnimationEnd);
    }

    private destroyed() {
      eventBus.$off(Bus.Memo.moveAnimationEnd, this.onMoveAnimationEnd);
    }

    // ==================== Life Cycle END ====================

  }
</script>

<style scoped lang="scss">
  .memo {
    position: absolute;
    opacity: 0.9;
    background-color: $color-table;

    &.active {
      border: solid $color-table-active 1px;
      box-shadow: 0 1px 6px $color-table-active;
    }

    .memo-header {
      padding: $size-memo-padding;
      opacity: 0.9;
      background-color: $color-table;

      .memo-button {
        float: right;
      }
    }

    .memo-body {

      textarea {
        font-size: $size-font + 2;
        padding: $size-memo-padding;
        border: none;
        resize: none;
        opacity: 0.9;
        background-color: $color-table;
        color: $color-font-active;
        outline: none;
      }
    }

    .memo-footer {

    }
  }
</style>
