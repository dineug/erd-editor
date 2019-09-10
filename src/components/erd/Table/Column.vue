<template lang="pug">
  .column
</template>

<script lang="ts">
  import {Column as ColumnModel} from '@/store/table';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Column extends Vue {
    @Prop({type: Object, default: () => ({})})
    private column!: ColumnModel;

  }
</script>

<style scoped lang="scss">
  .column {

  }
</style>
