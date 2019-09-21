<template lang="pug">
  .preview
    Table(
      v-for="table in tables"
      :key="table.id"
      :table="table"
    )
    Memo(
      v-for="memo in memos"
      :key="memo.id"
      :memo="memo"
    )
    Relationship(
      v-for="relationship in relationships"
      :key="relationship.id"
      :relationship="relationship"
    )
</template>

<script lang="ts">
  import {Table as TableModel} from '@/store/table';
  import {Memo as MemoModel} from '@/store/memo';
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Preview/Table.vue';
  import Memo from './Preview/Memo.vue';
  import Relationship from './Preview/Relationship.vue';

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
    },
  })
  export default class Preview extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;

    get tables(): TableModel[] {
      return this.store.tableStore.state.tables;
    }

    get memos(): MemoModel[] {
      return this.store.memoStore.state.memos;
    }

    get relationships(): RelationshipModel[] {
      return this.store.relationshipStore.state.relationships;
    }

  }
</script>

<style scoped lang="scss">
  .preview {

  }
</style>
