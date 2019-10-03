<template lang="pug">
  g.relationship-zero-one
    // start
    line(
      :x1="path.path.line.start.x1"
      :y1="path.path.line.start.y1"
      :x2="path.path.line.start.x2"
      :y2="path.path.line.start.y2"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      stroke-width="3"
    )
    path(
      :d="path.path.path.d()"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      :stroke-dasharray="relationship.identification ? 0 : 10"
      stroke-width="3"
      fill="transparent"
    )
    line(
      :x1="path.line.line.start.x1"
      :y1="path.line.line.start.y1"
      :x2="path.line.line.start.x2"
      :y2="path.line.line.start.y2"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      stroke-width="3"
    )

    // end
    line(
      :x1="path.path.line.end.x1" :y1="path.path.line.end.y1"
      :x2="path.path.line.end.x2" :y2="path.path.line.end.y2"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      stroke-width="3"
    )
    circle(
      :cx="path.line.circle.cx" :cy="path.line.circle.cy" r="8"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      fill-opacity="0.0" stroke-width="3"
    )
    line(
      :x1="path.line.line.end.base.x1" :y1="path.line.line.end.base.y1"
      :x2="path.line.line.end.base.x2" :y2="path.line.line.end.base.y2"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      stroke-width="3"
    )
    line(
      :x1="path.line.line.end.center.x1" :y1="path.line.line.end.center.y1"
      :x2="path.line.line.end.center.x2" :y2="path.line.line.end.center.y2"
      :stroke="relationship.identification ? '#60b9c4' : '#dda8b1'"
      stroke-width="3"
    )
</template>

<script lang="ts">
  import {Relationship} from '@/store/relationship';
  import {getZeroOne, RelationshipPath} from '@/store/relationship/relationshipHelper';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class ZeroOne extends Vue {
    @Prop({type: Object, default: () => ({})})
    private relationship!: Relationship;

    get path(): RelationshipPath {
      return getZeroOne(this.relationship);
    }
  }
</script>

<style scoped lang="scss">
  .relationship-zero-one {

  }
</style>
