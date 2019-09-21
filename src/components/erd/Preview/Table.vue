<template lang="pug">
  .preview-table
</template>

<script lang="ts">
  import {Table as TableModel} from '@/store/table';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Table extends Vue {
    @Prop({type: Object, default: () => ({})})
    private table!: TableModel;
  }
</script>

<style scoped lang="scss">
  .preview-table {

  }
</style>
