<template lang="pug">
  .workspace-vuerd
    Vuerd(
      :focus="true"
      :undo="undo"
      :redo="redo"
      :width="width"
      :height="height"
      :value="value"
      @change="onChange"
      @undo="onUndo"
      @redo="onRedo"
    )
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Vuerd from "@/components";
// @ts-ignore
import UndoManager from "undo-manager";

@Component({
  components: {
    Vuerd
  }
})
export default class App extends Vue {
  private width = 2000;
  private height = 2000;
  private value = "";
  private undo = false;
  private redo = false;
  private undoManager = new UndoManager();

  private onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  private hasUndoRedo() {
    this.undo = this.undoManager.hasUndo();
    this.redo = this.undoManager.hasRedo();
  }

  private onChange(value: string) {
    if (this.value !== "" && this.value !== value) {
      const oldValue = this.value;
      this.undoManager.add({
        undo: () => {
          this.value = oldValue;
        },
        redo: () => {
          this.value = value;
        }
      });
    }
    this.value = value;
  }

  private onUndo() {
    this.undoManager.undo();
  }

  private onRedo() {
    this.undoManager.redo();
  }

  private created() {
    this.undoManager.setCallback(this.hasUndoRedo);
  }

  private mounted() {
    window.addEventListener("resize", this.onResize);
    window.dispatchEvent(new Event("resize"));
  }

  private destroyed() {
    window.removeEventListener("resize", this.onResize);
  }
}
</script>

<style lang="scss">
body {
  margin: 0;
}
.workspace-vuerd {
  overflow: hidden;
  height: 100vh;
}
</style>
