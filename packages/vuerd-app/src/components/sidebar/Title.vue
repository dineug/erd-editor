<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    label: {
      type: String,
      default: '',
    },
  },
});
</script>

<template>
  <div class="title">
    <div class="title-label">
      <span>{{ label }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.title {
  display: flex;
  height: 35px;
  box-sizing: border-box;
  overflow: hidden;
  padding-left: 8px;
  padding-right: 8px;

  .title-label {
    line-height: 35px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 12px;

    span {
      font-size: 13px;
      overflow: hidden;
    }
  }
}
</style>
