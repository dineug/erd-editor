<template lang="pug">
  svg.preview-relationship
</template>

<script lang="ts">
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Relationship extends Vue {
    @Prop({type: Object, default: () => ({})})
    private relationship!: RelationshipModel;
  }
</script>

<style scoped lang="scss">
  .preview-relationship {

  }
</style>
