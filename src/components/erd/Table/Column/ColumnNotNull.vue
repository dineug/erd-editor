<template lang="pug">
  .column-not-null(
    :class="{focus}"
    :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
    @mousedown="onMousedown"
    @dblclick="onDblclick"
  )
    span(v-if="column.option.notNull") N-N
    span(v-else) NULL
</template>

<script lang="ts">
import { SIZE_COLUMN_OPTION_NN } from '@/ts/layout'
import { Column } from '@/store/table'
import { ColumnFocus } from '@/models/ColumnFocusModel'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class ColumnNotNull extends Vue {
  @Prop({type: Object, default: () => ({})})
  private column!: Column
  @Prop({type: Object, default: null})
  private columnFocus!: ColumnFocus | null

  private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN

  get focus (): boolean {
    let result = false
    if (this.columnFocus && this.columnFocus.focusNotNull) {
      result = true
    }
    return result
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
  .column-not-null {

  }
</style>
