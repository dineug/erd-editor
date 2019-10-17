<template lang="pug">
  input.column-comment(
    v-if="edit"
    v-focus
    v-model="column.comment"
    :style="`width: ${width}px;`"
    spellcheck="false"
    @input="onInput"
    @blur="onBlur"
  )
  .column-comment(
    v-else
    :class="{focus, placeholder}"
    :style="`width: ${width}px;`"
    @mousedown="onMousedown"
    @dblclick="onDblclick"
  )
    span {{value}}
</template>

<script lang="ts">
import { Column } from '@/store/table'
import { ColumnFocus } from '@/models/ColumnFocusModel'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({
  directives: {
    focus: {
      inserted (el: HTMLElement) {
        el.focus()
      }
    }
  }
})
export default class ColumnComment extends Vue {
  @Prop({type: Object, default: () => ({})})
  private column!: Column
  @Prop({type: Object, default: null})
  private columnFocus!: ColumnFocus | null
  @Prop({type: Boolean, default: false})
  private edit!: boolean
  @Prop({type: Number, default: 0})
  private width!: number

  get focus (): boolean {
    let result = false
    if (this.columnFocus && this.columnFocus.focusComment) {
      result = true
    }
    return result
  }

  get placeholder (): boolean {
    let result = false
    if (this.column.comment.trim() === '') {
      result = true
    }
    return result
  }

  get value (): string {
    let value = 'comment'
    if (this.column.comment.trim() !== '') {
      value = this.column.comment
    }
    return value
  }

  private onInput (event: InputEvent) {
    this.$emit('input', event)
  }

  private onBlur (event: InputEvent) {
    this.$emit('blur', event)
  }

  private onMousedown (event: MouseEvent) {
    this.$emit('mousedown', event)
  }

  private onDblclick (event: MouseEvent) {
    this.$emit('dblclick', event)
  }
}
</script>

<style scoped lang="scss">
  .column-comment {

  }
</style>
