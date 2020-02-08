<template lang="pug">
  .erd-import-error-ddl(
    :style="importErrorStyle"
    @mousedown="onMousedown"
    @touchstart="onTouchstart"
    @dblclick="onClose"
  )
    .erd-import-error-box
      CircleButton.erd-import-error-close(
        title="ESC"
        close
        @click="onClose"
      )
      .erd-import-error-head
        span.erd-import-error-title Import SQL DDL Error
      .erd-import-error-body.scrollbar {{ message }}
      .erd-import-error-footer(style="font-size")
        span DDL Parser with by&nbsp;
        a(
          href="https://github.com/duartealexf/sql-ddl-to-json-schema"
          target="_blank"
        ) sql-ddl-to-json-schema
</template>

<script lang="ts">
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue } from "vue-property-decorator";
import CircleButton from "@/components/erd/CircleButton.vue";
import hljs from "@/plugins/highlight";

@Component({
  components: {
    CircleButton
  }
})
export default class ImportErrorDDL extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: String, default: "" })
  private message!: string;

  get importErrorStyle(): string {
    const option = this.store.canvasStore.state;
    return `
        left: ${option.scrollLeft}px;
        top: ${option.scrollTop}px;
    `;
  }

  private onClose() {
    this.$emit("close");
  }

  private onMousedown(event: MouseEvent) {
    event.stopPropagation();
    const el = event.target as HTMLElement;
    if (el) {
      if (!el.closest(".erd-import-error-box")) {
        this.$emit("close");
      }
    }
  }

  private onTouchstart(event: TouchEvent) {
    event.stopPropagation();
    const el = event.target as HTMLElement;
    if (el) {
      if (!el.closest(".erd-import-error-box")) {
        this.$emit("close");
      }
    }
  }
}
</script>

<style scoped lang="scss">
.erd-import-error-ddl {
  position: absolute;
  z-index: 100000002;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  font-size: $size-font + 5px;

  .erd-import-error-box {
    position: absolute;
    background-color: black;
    width: 500px;
    height: 300px;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    padding: 20px;
    box-sizing: border-box;

    .erd-import-error-close {
      float: right;
    }

    .erd-import-error-head {
      .erd-import-error-title {
        width: 70%;
        display: inline-block;
      }
    }

    .erd-import-error-body {
      width: 100%;
      height: calc(100% - 42px);
      white-space: pre;
      overflow: auto;
    }

    .erd-import-error-footer {
      font-size: $size-font + 2;

      a {
        color: $color-font;
      }
    }
  }
}
</style>
