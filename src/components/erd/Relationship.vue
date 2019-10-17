<template lang="pug">
  g.relationship(
    :data-id="relationship.id"
    @mouseover="onMouseover"
    @mouseleave="onMouseleave"
  )
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
import { Relationship as RelationshipModel, Commit } from '@/store/relationship'
import StoreManagement from '@/store/StoreManagement'
import { Component, Prop, Vue } from 'vue-property-decorator'
import ZeroOne from './Relationship/ZeroOne.vue'
import ZeroOneN from './Relationship/ZeroOneN.vue'

const enum Color {
  active = '#ffc107',
  identification = '#60b9c4',
  notIdentification = '#dda8b1',
}

@Component({
  components: {
    ZeroOne,
    ZeroOneN
  }
})
export default class Relationship extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: Object, default: () => ({})})
  private relationship!: RelationshipModel

  private active: boolean = false;

  get stroke (): string {
    let color = Color.notIdentification
    if (this.active) {
      color = Color.active
    } else if (this.relationship.identification) {
      color = Color.identification
    }
    return color
  }

  private onMouseover () {
    this.active = true
    this.store.relationshipStore.commit(Commit.relationshipActive, {
      relationship: this.relationship,
      store: this.store
    })
  }

  private onMouseleave () {
    this.active = false
    this.store.relationshipStore.commit(Commit.relationshipActiveEnd, {
      relationship: this.relationship,
      store: this.store
    })
  }
}
</script>

<style scoped lang="scss">
  .relationship {

  }
</style>
