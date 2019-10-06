<template lang="pug">
  textarea.sql(
    :value="value"
    spellcheck="false"
  )
</template>

<script lang="ts">
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class SQL extends Vue {
    @Prop({type: String, default: ''})
    private value!: string;
  }
</script>

<style scoped lang="scss">
  .sql {
    margin-top: $size-top-menu-height;
    width: 100%;
    height: 100%;
    background-color: $color-table;
    opacity: 0.9;
    color: $color-font-active;

    padding: 0;
    border: none;
    resize: none;
    outline: none;
  }
</style>
