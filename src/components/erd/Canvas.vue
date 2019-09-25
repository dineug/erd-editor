<template lang="pug">
  .canvas(:style="`width: ${option.width}px; height: ${option.height}px;`")
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
</template>

<script lang="ts">
  import {State} from '@/store/canvas';
  import {Table as TableModel} from '@/store/table';
  import {Memo as MemoModel} from '@/store/memo';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Table.vue';
  import Memo from './Memo.vue';
  import Relationship from './Relationship.vue';

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
    },
  })
  export default class Canvas extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Boolean, default: false})
    private focus!: boolean;

    get option(): State {
      return this.store.canvasStore.state;
    }

    get tables(): TableModel[] {
      return this.store.tableStore.state.tables;
    }

    get memos(): MemoModel[] {
      return this.store.memoStore.state.memos;
    }

  }
</script>

<style scoped lang="scss">
  .canvas {
    position: relative;
    background-color: $color-canvas;
  }
</style>
