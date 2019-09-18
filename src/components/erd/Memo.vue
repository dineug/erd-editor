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
        v-focus
        spellcheck="false"
      )
    Sash(
      vertical
      @mousemove="onMousemoveSash($event, 'left')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      :left="width"
      vertical
      @mousemove="onMousemoveSash($event, 'right')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      horizontal
      @mousemove="onMousemoveSash($event, 'top')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      :top="height"
      horizontal
      @mousemove="onMousemoveSash($event, 'bottom')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      edge
      @mousemove="onMousemoveSash($event, 'lt')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      edge
      :left="width"
      @mousemove="onMousemoveSash($event, 'rt')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      edge
      :top="height"
      @mousemove="onMousemoveSash($event, 'lb')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
    Sash(
      edge
      :left="width"
      :top="height"
      @mousemove="onMousemoveSash($event, 'rb')"
      @mousedown="onMousedownSash"
      @mouseup="onMouseupSash"
    )
</template>

<script lang="ts">
  import {SIZE_MEMO_PADDING, SIZE_MEMO_WIDTH, SIZE_MEMO_HEIGHT} from '@/ts/layout';
  import memoStore, {Memo as MemoModel, Commit} from '@/store/memo';
  import canvasStore, {Show} from '@/store/canvas';
  import eventBus, {Bus} from '@/ts/EventBus';
  import {log} from '@/ts/util';
  import AnimationFrame from '@/ts/AnimationFrame';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import CircleButton from './CircleButton.vue';
  import Sash from './Sash.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
  const MEMO_HEADER = 17 + SIZE_MEMO_PADDING;

  enum Horizon {
    horizontal = 'horizontal',
    vertical = 'vertical',
  }

  enum Direction {
    left = 'left',
    right = 'right',
    top = 'top',
    bottom = 'bottom',
    lt = 'lt',
    rt = 'rt',
    lb = 'lb',
    rb = 'rb',
  }

  @Component({
    components: {
      CircleButton,
      Sash,
    },
    directives: {
      focus: {
        inserted(el: HTMLElement) {
          el.focus();
        },
      },
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

    private x: number = 0;
    private y: number = 0;

    get memoStyle(): string {
      return `
        top: ${this.memo.ui.top}px;
        left: ${this.memo.ui.left}px;
        width: ${this.width}px;
        height: ${this.height}px;
        z-index: ${this.memo.ui.zIndex};
      `;
    }

    get textareaStyle(): string {
      return `
        width: ${this.memo.ui.width}px;
        height: ${this.memo.ui.height}px;
      `;
    }

    get width(): number {
      return this.memo.ui.width + MEMO_PADDING;
    }

    get height(): number {
      return this.memo.ui.height + MEMO_PADDING + MEMO_HEADER;
    }

    private resizeWidth(event: MouseEvent, position: Direction) {
      const direction: Direction = event.movementX < 0 ? Direction.left : Direction.right;
      const width = position === Direction.left
        ? this.memo.ui.width - event.movementX
        : this.memo.ui.width + event.movementX;
      switch (direction) {
        case Direction.left:
          if (SIZE_MEMO_WIDTH < width && event.x < this.x) {
            this.memo.ui.width = width;
            if (position === Direction.left) {
              this.memo.ui.left += event.movementX;
            }
            this.x += event.movementX;
          }
          break;
        case Direction.right:
          if (SIZE_MEMO_WIDTH < width && event.x > this.x) {
            this.memo.ui.width = width;
            if (position === Direction.left) {
              this.memo.ui.left += event.movementX;
            }
            this.x += event.movementX;
          }
          break;
      }
    }

    private resizeHeight(event: MouseEvent, position: Direction) {
      const direction: Direction = event.movementY < 0 ? Direction.top : Direction.bottom;
      const height = position === Direction.top
        ? this.memo.ui.height - event.movementY
        : this.memo.ui.height + event.movementY;
      switch (direction) {
        case Direction.top:
          if (SIZE_MEMO_HEIGHT < height && event.y < this.y) {
            this.memo.ui.height = height;
            if (position === Direction.top) {
              this.memo.ui.top += event.movementY;
            }
            this.y += event.movementY;
          }
          break;
        case Direction.bottom:
          if (SIZE_MEMO_HEIGHT < height && event.y > this.y) {
            this.memo.ui.height = height;
            if (position === Direction.top) {
              this.memo.ui.top += event.movementY;
            }
            this.y += event.movementY;
          }
          break;
      }
    }

    // ==================== Event Handler ===================
    private onMousedown(event: MouseEvent) {
      log.debug('Memo onMousedown');
      const el = event.target as HTMLElement;
      if (!el.closest('.memo-button') && !el.closest('.sash')) {
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

    private onMousemoveSash(event: MouseEvent, position: Direction) {
      log.debug('Memo onMousemoveSash');
      switch (position) {
        case Direction.left:
        case Direction.right:
          this.resizeWidth(event, position);
          break;
        case Direction.top:
        case Direction.bottom:
          this.resizeHeight(event, position);
          break;
        case Direction.lt:
          this.resizeWidth(event, Direction.left);
          this.resizeHeight(event, Direction.top);
          break;
        case Direction.rt:
          this.resizeWidth(event, Direction.right);
          this.resizeHeight(event, Direction.top);
          break;
        case Direction.lb:
          this.resizeWidth(event, Direction.left);
          this.resizeHeight(event, Direction.bottom);
          break;
        case Direction.rb:
          this.resizeWidth(event, Direction.right);
          this.resizeHeight(event, Direction.bottom);
          break;
      }
    }

    private onMousedownSash(event: MouseEvent) {
      log.debug('Memo onMousedownSash');
      this.x = event.x;
      this.y = event.y;
    }

    private onMouseupSash(event: MouseEvent) {
      log.debug('Memo onMouseupSash');
      this.onMouseup(event);
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
  }
</style>
