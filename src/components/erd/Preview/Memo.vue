<template lang="pug">
  .preview-memo(:style="memoStyle")
    //.memo-header
      .memo-button
    //.memo-body
      div(:style="textareaStyle") {{memo.value}}
</template>

<script lang="ts">
import { SIZE_MEMO_PADDING } from '@/ts/layout'
import { Memo as MemoModel } from '@/store/memo'
import { Component, Prop, Vue } from 'vue-property-decorator'
import CircleButton from '../CircleButton.vue'

const MEMO_PADDING = SIZE_MEMO_PADDING * 2
const MEMO_HEADER = 17 + SIZE_MEMO_PADDING

@Component({
  components: {
    CircleButton
  }
})
export default class Memo extends Vue {
  @Prop({type: Object, default: () => ({})})
  private memo!: MemoModel

  get memoStyle (): string {
    return `
        top: ${this.memo.ui.top}px;
        left: ${this.memo.ui.left}px;
        width: ${this.width}px;
        height: ${this.height}px;
        z-index: ${this.memo.ui.zIndex};
      `
  }

  get textareaStyle (): string {
    return `
        width: ${this.memo.ui.width}px;
        height: ${this.memo.ui.height}px;
      `
  }

  get width (): number {
    return this.memo.ui.width + MEMO_PADDING
  }

  get height (): number {
    return this.memo.ui.height + MEMO_PADDING + MEMO_HEADER
  }
}
</script>

<style scoped lang="scss">
  .preview-memo {
    position: absolute;
    opacity: 0.9;
    background-color: $color-table;
    cursor: default;

    .memo-header {
      padding: $size-memo-padding;
      opacity: 0.9;
      background-color: $color-table;

      .memo-button {
        float: right;
      }
    }

    .memo-body {

      div {
        font-size: $size-font + 2;
        padding: $size-memo-padding;
        opacity: 0.9;
        background-color: $color-table;
        color: $color-font-active;
      }
    }
  }
</style>
