<template lang="pug">
  .canvas(:style="canvasStyle")
    Table(
      v-for="table in tables"
      :key="table.id"
      :store="store"
      :focus="focus"
      :table="table"
    )
    Memo(
      v-for="memo in memos"
      :key="memo.id"
      :store="store"
      :memo="memo"
    )
    svg.canvas-svg(
      v-if="show.relationship"
      :style="canvasStyle"
    )
      Relationship(
        v-for="relationship in relationships"
        :key="relationship.id"
        :store="store"
        :relationship="relationship"
      )
</template>

<script lang="ts">
import { Table as TableModel } from '@/store/table'
import { Memo as MemoModel } from '@/store/memo'
import { Relationship as RelationshipModel } from '@/store/relationship'
import { Show } from '@/store/canvas'
import StoreManagement from '@/store/StoreManagement'
import { Component, Prop, Vue } from 'vue-property-decorator'
import Table from './Table.vue'
import Memo from './Memo.vue'
import Relationship from './Relationship.vue'

@Component({
  components: {
    Table,
    Memo,
    Relationship
  }
})
export default class Canvas extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: Boolean, default: false})
  private focus!: boolean

  get canvasStyle (): string {
    const option = this.store.canvasStore.state
    return `
        width: ${option.width}px;
        height: ${option.height}px;
      `
  }

  get tables (): TableModel[] {
    return this.store.tableStore.state.tables
  }

  get memos (): MemoModel[] {
    return this.store.memoStore.state.memos
  }

  get relationships (): RelationshipModel[] {
    return this.store.relationshipStore.state.relationships
  }

  get show (): Show {
    return this.store.canvasStore.state.show
  }
}
</script>

<style scoped lang="scss">
  .canvas {
    position: relative;
    background-color: $color-canvas;

    .canvas-svg {
      position: absolute;
      z-index: 1;
    }
  }
</style>
