<template lang="pug">
  textarea.sql.scrollbar(
    :value="value"
    spellcheck="false"
  )
</template>

<script lang="ts">
  import {Commit as CanvasCommit} from '@/store/canvas';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class SQL extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: String, default: ''})
    private value!: string;

    private mounted() {
      if (this.$el.parentElement) {
        this.$el.parentElement.scrollTop = 0;
        this.$el.parentElement.scrollLeft = 0;
        this.store.canvasStore.commit(CanvasCommit.canvasMove, {
          scrollTop: this.$el.parentElement.scrollTop,
          scrollLeft: this.$el.parentElement.scrollLeft,
        });
      }
    }
  }
</script>

<style scoped lang="scss">
  .sql {
    margin-top: $size-top-menu-height;
    width: 100%;
    height: calc(100% - 30px);
    background-color: $color-table;
    opacity: 0.9;
    color: $color-font-active;

    padding: 0;
    border: none;
    resize: none;
    outline: none;
  }
</style>
