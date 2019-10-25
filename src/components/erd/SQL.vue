<template lang="pug">
  pre.workspace-sql
    code.sql.scrollbar(
      contenteditable="true"
      spellcheck="false"
      ref="code"
    ) {{value}}
</template>

<script lang="ts">
import hljs from "@/plugins/highlight";
import { Commit as CanvasCommit } from "@/store/canvas";
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class SQL extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: String, default: "" })
  private value!: string;

  private mounted() {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0;
      this.$el.parentElement.scrollLeft = 0;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: this.$el.parentElement.scrollTop,
        scrollLeft: this.$el.parentElement.scrollLeft
      });
    }

    hljs.highlightBlock(this.$refs.code);
  }
}
</script>

<style scoped lang="scss">
@import "~highlight.js/styles/monokai-sublime.css";

.workspace-sql {
  margin-top: $size-top-menu-height;
  height: calc(100% - 30px);

  .sql {
    height: calc(100% - 10px);
    padding: 5px;
    background-color: $color-sql;
  }
}
</style>
