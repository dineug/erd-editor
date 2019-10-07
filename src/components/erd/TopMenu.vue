import {CanvasType} from '@/store/canvas'
<template lang="pug">
  ul.top-menu(:style="topMenuStyle")
    li
      input(
        type="text"
        placeholder="database name"
        spellcheck="false"
        title="database name"
        v-model="store.canvasStore.state.databaseName"
        @change="onChange"
      )
    li(
      title="ERD"
      :class="{active: canvasType === 'ERD'}"
      @click="onCanvasType('ERD')"
    )
      font-awesome-icon(icon="bezier-curve")
    li(
      title="SQL"
      :class="{active: canvasType === 'SQL'}"
      @click="onCanvasType('SQL')"
    )
      font-awesome-icon(icon="code")
    li(
      title="list"
      :class="{active: canvasType === 'List'}"
      @click="onCanvasType('List')"
    )
      font-awesome-icon(icon="list")
    li.undo-redo(
      title="undo(Ctrl + Z)"
      :class="{active: undo}"
      @click="onUndo"
    )
      font-awesome-icon(icon="undo-alt")
    li.undo-redo(
      title="redo(Ctrl + Shift + Z)"
      :class="{active: redo}"
      @click="onRedo"
    )
      font-awesome-icon(icon="redo-alt")
    li.search(v-if="canvasType === 'List'")
      font-awesome-icon(icon="search")
    li(v-if="canvasType === 'List'")
      input(
        type="text"
        placeholder="search"
        spellcheck="false"
        title="search"
        v-model="search"
        @input="onSearch"
      )
</template>

<script lang="ts">
  import {SIZE_TOP_MENU_HEIGHT} from '@/ts/layout';
  import {CanvasType, Commit} from '@/store/canvas';
  import {Bus} from '@/ts/EventBus';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue, Watch} from 'vue-property-decorator';

  @Component
  export default class TopMenu extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;
    @Prop({type: Boolean, default: false})
    private undo!: boolean;
    @Prop({type: Boolean, default: false})
    private redo!: boolean;

    private search: string = '';

    get topMenuStyle(): string {
      const left = this.store.canvasStore.state.scrollLeft;
      const top = this.store.canvasStore.state.scrollTop;
      return `
        width: ${this.width}px;
        height: ${SIZE_TOP_MENU_HEIGHT}px;
        left: ${left}px;
        top: ${top}px;
      `;
    }

    get canvasType(): CanvasType {
      return this.store.canvasStore.state.canvasType;
    }

    @Watch('canvasType')
    private watchCanvasType(canvasType: CanvasType) {
      if (canvasType === CanvasType.List) {
        this.store.eventBus.$emit(Bus.TableList.search, this.search);
      }
    }

    // ==================== Event Handler ===================
    private onCanvasType(canvasType: CanvasType) {
      this.store.canvasStore.commit(Commit.canvasChangeType, canvasType);
    }

    private onUndo() {
      this.$emit('undo');
    }

    private onRedo() {
      this.$emit('redo');
    }

    private onChange() {
      this.store.eventBus.$emit(Bus.ERD.change);
    }

    private onSearch() {
      this.store.eventBus.$emit(Bus.TableList.search, this.search);
    }

    // ==================== Event Handler END ===================

  }
</script>

<style scoped lang="scss">
  .top-menu {
    position: absolute;
    overflow: hidden;
    z-index: 100000002;
    background-color: $color-table;
    opacity: 0.9;
    display: flex;
    align-items: center;

    li {
      display: inline-flex;
      margin-left: 10px;
      cursor: pointer;

      &:first-child {
        margin-left: 20px;
      }

      &.undo-redo {
        cursor: default;
      }

      &.active {
        cursor: pointer;
        color: $color-font-active;
      }

      &.search {
        cursor: default;
      }
    }

    input {
      outline: none;
      border: none;
      opacity: 0.9;
      background-color: $color-table;
      color: $color-font-active;
      width: 200px;
    }
  }

  ul, ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
