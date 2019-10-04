<template lang="pug">
  g.preview-relationship
    ZeroOne(
      v-if="relationship.relationshipType === 'ZeroOne'"
      :relationship="relationship"
      :stroke="stroke"
    )
    ZeroOneN(
      v-else-if="relationship.relationshipType === 'ZeroOneN'"
      :relationship="relationship"
      :stroke="stroke"
    )
</template>

<script lang="ts">
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import ZeroOne from '../Relationship/ZeroOne.vue';
  import ZeroOneN from '../Relationship/ZeroOneN.vue';

  const enum Color {
    active = '#ffc107',
    identification = '#60b9c4',
    notIdentification = '#dda8b1',
  }

  @Component({
    components: {
      ZeroOne,
      ZeroOneN,
    },
  })
  export default class Relationship extends Vue {
    @Prop({type: Object, default: () => ({})})
    private relationship!: RelationshipModel;

    get stroke(): string {
      let color = Color.notIdentification;
      if (this.relationship.identification) {
        color = Color.identification;
      }
      return color;
    }
  }
</script>

<style scoped lang="scss">
  .preview-relationship {

  }
</style>
