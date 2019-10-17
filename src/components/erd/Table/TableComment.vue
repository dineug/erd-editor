<template lang="pug">
  input(
    v-if="edit"
    v-focus
    v-model="table.comment"
    :style="`width: ${width}px;`"
    spellcheck="false"
    @input="onInput"
    @blur="onBlur"
  )
  .table-comment(
    v-else
    :class="{focus, placeholder}"
    :style="`width: ${width}px;`"
    @mousedown="onMousedown"
    @dblclick="onDblclick"
  )
    span {{value}}
</template>

<script lang="ts">
import { Table } from '@/store/table'
import { TableFocus } from '@/models/TableFocusModel'
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
export default class TableComment extends Vue {
  @Prop({type: Object, default: () => ({})})
  private table!: Table
  @Prop({type: Object, default: null})
  private tableFocus!: TableFocus | null
  @Prop({type: Boolean, default: false})
  private edit!: boolean
  @Prop({type: Number, default: 0})
  private width!: number

  get focus (): boolean {
    let result = false
    if (this.tableFocus &&
      this.tableFocus.id === this.table.id &&
      this.tableFocus.focusComment) {
      result = true
    }
    return result
  }

  get placeholder (): boolean {
    let result = false
    if (this.table.comment.trim() === '') {
      result = true
    }
    return result
  }

  get value (): string {
    let value = 'comment'
    if (this.table.comment.trim() !== '') {
      value = this.table.comment
    }
    return value
  }

  private onInput (event: Event) {
    this.$emit('input', event)
  }

  private onBlur (event: Event) {
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
  .table-comment {

  }
</style>
