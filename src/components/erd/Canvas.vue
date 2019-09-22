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
    RelationshipEdit(
      v-if="relationshipEdit && relationshipEdit.start"
      :store="store"
    )
</template>

<script lang="ts">
  import {State} from '@/store/canvas';
  import {Table as TableModel} from '@/store/table';
  import {Memo as MemoModel} from '@/store/memo';
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Table.vue';
  import Memo from './Memo.vue';
  import Relationship from './Relationship.vue';
  import RelationshipEdit from './RelationshipEdit.vue';

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
      RelationshipEdit,
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

    get relationshipEdit(): RelationshipModel | null {
      return this.store.relationshipStore.state.edit;
    }

  }
</script>

<style scoped lang="scss">
  .canvas {
    position: relative;
    z-index: 200;
    background-color: $color-canvas;
  }
</style>
