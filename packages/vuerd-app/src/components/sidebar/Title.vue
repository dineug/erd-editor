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
div(class="flex overflow-hidden box-border pl-2 pr-2 h-9")
  div(class="h-9 overflow-hidden overflow-ellipsis pl-3 whitespace-nowrap")
    span(class="overflow-hidden text-sm") {{ label }}
</template>
