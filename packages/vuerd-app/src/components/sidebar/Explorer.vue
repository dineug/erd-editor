<script lang="ts">
import { defineComponent } from 'vue';

import Title from '@/components/sidebar/Title.vue';

export default defineComponent({
  components: {
    Title,
  },
});
</script>

<template lang="pug">
.explorer
  Title(label="Explorer")
  Title(label="Open Files")
  Title(label="Workspace")
</template>

<style scoped lang="scss">
.explorer {
  @apply flex flex-col h-full border border-solid;
  border-color: transparent;
  background-color: var(--sidebar-background);
}
</style>
