<template lang="pug">
  VuerdCore(v-model="tree")
</template>

<script lang="ts">
  import {Component, Vue} from 'vue-property-decorator';
  import {Tree} from 'vuerd-core';

  @Component
  export default class App extends Vue {
    private tree: Tree = {
      name: 'example',
      open: true,
      children: [
        {
          name: 'hellow ERD.vuerd',
          read: async (path, id) => {
            return '';
          },
        },
      ],
    };
  }
</script>

<style lang="scss">
</style>
