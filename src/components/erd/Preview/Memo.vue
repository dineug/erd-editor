<template lang="pug">
  .preview-memo
</template>

<script lang="ts">
  import {Memo as MemoModel} from '@/store/memo';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Memo extends Vue {
    @Prop({type: Object, default: () => ({})})
    private memo!: MemoModel;
  }
</script>

<style scoped lang="scss">
  .preview-memo {

  }
</style>
