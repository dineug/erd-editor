<template lang="pug">
  .erd-generator-code
    code.generator-code.hljs.scrollbar(
      contenteditable="true"
      spellcheck="false"
      v-html="value"
    )
</template>

<script lang="ts">
import CodeFactory, { Language } from "@/ts/GeneratorCode";
import StoreManagement from "@/store/StoreManagement";
import { Commit as CanvasCommit } from "@/store/canvas";
import { Bus } from "@/ts/EventBus";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import hljs from "@/plugins/highlight";

@Component
export default class GeneratorCode extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;

  private value: string = "";

  @Watch("store.canvasStore.state.language")
  private watchLanguage() {
    this.convertCode();
  }

  @Watch("store.canvasStore.state.tableCase")
  private watchTableCase() {
    this.convertCode();
  }

  @Watch("store.canvasStore.state.columnCase")
  private watchColumnCase() {
    this.convertCode();
  }

  private convertCode() {
    const language = this.store.canvasStore.state.language;
    const code = CodeFactory.toCode(this.store);
    if (language === Language.graphql) {
      this.value = hljs.highlight(Language.typescript, code).value;
    } else {
      this.value = hljs.highlight(language, code).value;
    }
  }

  private created() {
    this.convertCode();
  }

  private mounted() {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0;
      this.$el.parentElement.scrollLeft = 0;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: 0,
        scrollLeft: 0
      });
      this.store.eventBus.$emit(Bus.ERD.change);
    }
  }
}
</script>

<style scoped lang="scss">
.erd-generator-code {
  margin-top: $size-top-menu-height;
  height: calc(100% - 30px);
  background-color: #ffc107;
  white-space: pre;

  .generator-code {
    height: 100%;
    padding: 5px;
    box-sizing: border-box;
    background-color: $color-sql;
  }
}
</style>
