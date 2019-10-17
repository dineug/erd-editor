<template lang="pug">
  input.column-data-type(
    v-if="edit"
    v-focus
    v-model="column.dataType"
    :style="`width: ${width}px;`"
    spellcheck="false"
    @input="onInput"
    @change="onChange"
    @blur="onBlur"
    @keydown="onKeydown"
  )
  .column-data-type(
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
import StoreManagement from '@/store/StoreManagement'
import { Bus } from '@/ts/EventBus'
import Key from '@/models/Key'
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
export default class ColumnDataType extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
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
    if (this.columnFocus && this.columnFocus.focusDataType) {
      result = true
    }
    return result
  }

  get placeholder (): boolean {
    let result = false
    if (this.column.dataType.trim() === '') {
      result = true
    }
    return result
  }

  get value (): string {
    let value = 'dataType'
    if (this.column.dataType.trim() !== '') {
      value = this.column.dataType
    }
    return value
  }

  // ==================== Event Handler ===================
  private onInput (event: InputEvent) {
    this.store.eventBus.$emit(Bus.DataTypeHint.search)
    this.$emit('input', event)
  }

  private onChange (event: InputEvent) {
    this.$emit('input', event)
  }

  private onBlur (event: InputEvent) {
    const el = event.target as HTMLElement
    if (!el.closest('.data-type')) {
      this.$emit('blur', event)
    }
  }

  private onMousedown (event: MouseEvent) {
    this.$emit('mousedown', event)
  }

  private onDblclick (event: MouseEvent) {
    this.$emit('dblclick', event)
  }

  private onChangeTrigger (data: { columnId: string, value: string }) {
    const {columnId, value} = data
    if (this.column.id === columnId) {
      if (this.$el.localName === 'input') {
        const input = this.$el as HTMLInputElement
        this.column.dataType = value
        input.value = value
        input.focus()
        input.dispatchEvent(new Event('change'))
      }
    }
  }

  private onKeydown (event: KeyboardEvent) {
    switch (event.key) {
      case Key.ArrowUp:
        this.store.eventBus.$emit(Bus.DataTypeHint.arrowUp, event)
        break
      case Key.ArrowDown:
        this.store.eventBus.$emit(Bus.DataTypeHint.arrowDown, event)
        break
      case Key.ArrowRight:
        this.store.eventBus.$emit(Bus.DataTypeHint.arrowRight, event)
        break
      case Key.ArrowLeft:
        this.store.eventBus.$emit(Bus.DataTypeHint.arrowLeft, event)
        break
    }
  }

  // ==================== Event Handler END ===================

  // ==================== Life Cycle ====================
  private created () {
    this.store.eventBus.$on(Bus.ColumnDataType.change, this.onChangeTrigger)
  }

  private destroyed () {
    this.store.eventBus.$off(Bus.ColumnDataType.change, this.onChangeTrigger)
  }

  // ==================== Life Cycle END ====================
}
</script>

<style scoped lang="scss">
  .column-data-type {

  }
</style>
