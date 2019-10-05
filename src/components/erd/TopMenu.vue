<template lang="pug">
  .top-menu(:style="topMenuStyle")
</template>

<script lang="ts">
  import {SIZE_TOP_MENU_HEIGHT} from '@/ts/layout';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class TopMenu extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;

    get topMenuStyle(): string {
      if (this.store.canvasStore) {
        const left = this.store.canvasStore.state.scrollLeft;
        const top = this.store.canvasStore.state.scrollTop;
        return `
        width: ${this.width}px;
        height: ${SIZE_TOP_MENU_HEIGHT}px;
        left: ${left}px;
        top: ${top}px;
      `;
      }
      return '';
    }

  }
</script>

<style scoped lang="scss">
  .top-menu {
    position: absolute;
    overflow: hidden;
    z-index: 100000002;
    background-color: $color-table;
    opacity: 0.9;
  }
</style>
