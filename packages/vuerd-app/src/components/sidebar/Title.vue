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

<template lang="pug">
div(class="flex items-center overflow-hidden box-border pl-2 pr-2 h-8" style="background-color: var(--sidebar-title-background);")
  div(class="overflow-hidden overflow-ellipsis pl-3 whitespace-nowrap")
    span(class="overflow-hidden text-sm") {{ label }}
</template>
