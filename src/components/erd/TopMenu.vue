<template lang="pug">
  div
    ul.top-menu(:style="topMenuStyle")
      li
        input.database-name(
          type="text"
          placeholder="database name"
          spellcheck="false"
          title="database name"
          v-model="store.canvasStore.state.databaseName"
          @change="onChange"
        )
      li
        input.canvas-size(
          type="text"
          placeholder="canvas size"
          title="canvas size"
          :value="store.canvasStore.state.width"
          @input="onInputSize"
          @change="onChangeSize"
        )
      li(
        title="ERD"
        :class="{active: canvasType === 'ERD'}"
        @click="onCanvasType('ERD')"
      )
        font-awesome-icon(icon="project-diagram" style="width: 20px; height: 16px;")
      li(
        title="List"
        :class="{active: canvasType === 'List'}"
        @click="onCanvasType('List')"
      )
        font-awesome-icon(icon="list" style="width: 16px; height: 16px;")
      li(
        title="SQL"
        :class="{active: canvasType === 'SQL'}"
        @click="onCanvasType('SQL')"
      )
        font-awesome-icon(icon="code" style="width: 20px; height: 16px;")
      li(
        title="GeneratorCode"
        :class="{active: canvasType === 'GeneratorCode'}"
        @click="onCanvasType('GeneratorCode')"
      )
        font-awesome-icon(icon="sliders-h" style="width: 16px; height: 16px;")
      li.undo-redo(
        title="undo(Ctrl + Z)"
        :class="{active: undo}"
        @click="onUndo"
      )
        font-awesome-icon(icon="undo-alt" style="width: 16px; height: 16px;")
      li.undo-redo(
        title="redo(Ctrl + Shift + Z)"
        :class="{active: redo}"
        @click="onRedo"
      )
        font-awesome-icon(icon="redo-alt" style="width: 16px; height: 16px;")
      li(title="Help" @click="onHelp(true)")
        font-awesome-icon(icon="question" style="width: 12px; height: 16px;")
      li.search(v-if="canvasType === 'List'")
        font-awesome-icon(icon="search" style="width: 16px; height: 16px;")
      li(v-if="canvasType === 'List'")
        input(
          type="text"
          placeholder="search"
          spellcheck="false"
          title="search"
          v-model="search"
          @input="onSearch"
        )
    help(v-if="help" :store="store" @close="onHelp(false)")
</template>

<script lang="ts">
import {
  SIZE_TOP_MENU_HEIGHT,
  SIZE_CANVAS_MIN,
  SIZE_CANVAS_MAX
} from "@/ts/layout";
import { CanvasType, Commit } from "@/store/canvas";
import { Bus } from "@/ts/EventBus";
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import Help from "./TopMenu/Help.vue";

@Component({
  components: {
    Help
  }
})
export default class TopMenu extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Number, default: 0 })
  private width!: number;
  @Prop({ type: Number, default: 0 })
  private height!: number;
  @Prop({ type: Boolean, default: false })
  private undo!: boolean;
  @Prop({ type: Boolean, default: false })
  private redo!: boolean;

  private search: string = "";
  private help: boolean = false;

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

  @Watch("canvasType")
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
    this.$emit("undo");
  }

  private onRedo() {
    this.$emit("redo");
  }

  private onChange() {
    this.store.eventBus.$emit(Bus.ERD.change);
  }

  private onSearch() {
    this.store.eventBus.$emit(Bus.TableList.search, this.search);
  }

  private onInputSize(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, "");
  }

  private onChangeSize(event: Event) {
    const input = event.target as HTMLInputElement;
    let size = Number(input.value);
    if (size < SIZE_CANVAS_MIN) {
      size = SIZE_CANVAS_MIN;
      input.value = `${size}`;
    }
    if (size > SIZE_CANVAS_MAX) {
      size = SIZE_CANVAS_MAX;
      input.value = `${size}`;
    }
    this.store.canvasStore.commit(Commit.canvasResize, {
      width: size,
      height: size
    });
    this.store.eventBus.$emit(Bus.ERD.change);
  }

  private onHelp(open: boolean) {
    this.help = open;
  }

  private onHelpStop() {
    this.help = false;
  }

  private created() {
    this.store.eventBus.$on(Bus.TopMenu.helpStop, this.onHelpStop);
  }

  private destroyed() {
    this.store.eventBus.$off(Bus.TopMenu.helpStop, this.onHelpStop);
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
      cursor: not-allowed;
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

    &.database-name {
      width: 200px;
    }

    &.canvas-size {
      width: 80px;
    }
  }
}

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
