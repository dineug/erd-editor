<script lang="ts">
import { defineComponent } from 'vue';

import Title from '@/components/sidebar/Title.vue';

export default defineComponent({
  components: {
    Title,
  },
});
</script>

<template>
  <div class="explorer">
    <Title label="Explorer" />
    <Title label="Open Files" />
    <Title label="Workspace" />
  </div>
</template>

<style scoped lang="scss">
.explorer {
  height: 100%;
  border: transparent solid 1px;
  background-color: var(--sidebar-background);
  display: flex;
  flex-direction: column;
}
</style>
