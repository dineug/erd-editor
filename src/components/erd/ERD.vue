<template lang="pug">
  .erd
</template>

<script lang="ts">
  import 'velocity-animate/velocity.min.js';

  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class ERD extends Vue {
    private value: string = '';
  }
</script>

<style scoped lang="scss">
  .erd {

  }
</style>
