<template lang="pug">
  .button(
    :class="{close, add}"
    :title="title"
    @click="$emit('click', $event)"
  )
    font-awesome-icon(v-if="close" icon="times")
    font-awesome-icon(v-else-if="add" icon="plus")
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class CircleButton extends Vue {
  @Prop({ type: Boolean, default: false })
  private close!: boolean;
  @Prop({ type: Boolean, default: false })
  private add!: boolean;
  @Prop({ type: String, default: "" })
  private title!: string;
}
</script>

<style scoped lang="scss">
.button {
  width: 17px;
  height: 17px;
  font-size: 0.7em;
  cursor: pointer;
  border-radius: 50%;
  display: inline-flex;
  justify-content: center;
  align-items: center;

  &.close {
    color: $color-button-close;
    background-color: $color-button-close;
  }

  &.add {
    color: $color-button-add;
    background-color: $color-button-add;
  }

  &:hover {
    color: $color-font-active;
  }
}
</style>
