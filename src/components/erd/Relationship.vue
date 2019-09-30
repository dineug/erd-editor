<template lang="pug">
  g.relationship
    ZeroOne(
      v-if="relationship.relationshipType === 'ZeroOne'"
      :relationship="relationship"
    )
    ZeroOneN(
      v-else-if="relationship.relationshipType === 'ZeroOneN'"
      :relationship="relationship"
    )
</template>

<script lang="ts">
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import ZeroOne from './Relationship/ZeroOne.vue';
  import ZeroOneN from './Relationship/ZeroOneN.vue';

  @Component({
    components: {
      ZeroOne,
      ZeroOneN,
    },
  })
  export default class Relationship extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Object, default: () => ({})})
    private relationship!: RelationshipModel;
  }
</script>

<style scoped lang="scss">
  .relationship {

  }
</style>
