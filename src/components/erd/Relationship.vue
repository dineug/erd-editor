<template lang="pug">
  .relationship
</template>

<script lang="ts">
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import ZeroOne from './Relationship/ZeroOne.vue';
  import ZeroOneN from './Relationship/ZeroOneN.vue';

  @Component({
    components: {
      ZeroOne,
      ZeroOneN,
    },
  })
  export default class Relationship extends Vue {
  }
</script>

<style scoped lang="scss">
  .relationship {

  }
</style>
