<template lang="pug">
  .relationship-edit
</template>

<script lang="ts">
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class RelationshipEdit extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;

  }
</script>

<style scoped lang="scss">
  .relationship-edit {

  }
</style>
