<template lang="pug">
  .erd-help(
    :style="helpStyle"
    @mousedown="onMousedown"
    @touchstart="onTouchstart"
    @dblclick="onClose"
  )
    .erd-help-box
      CircleButton.erd-help-close(
        title="ESC"
        close
        @click="onClose"
      )
      div
        div.erd-help-head
          span.erd-help-name Name
          span.erd-help-action Action
        div.erd-help-body(v-for="editorAction in editorActions" :key="editorActions.name")
          span.erd-help-name {{ editorAction.name }}
          span.erd-help-action {{ editorAction.action }}
</template>

<script lang="ts">
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue } from "vue-property-decorator";
import CircleButton from "@/components/erd/CircleButton.vue";

interface EditorAction {
  name: string;
  action: string;
}

@Component({
  components: {
    CircleButton
  }
})
export default class Help extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;

  private editorActions: EditorAction[] = [
    {
      name: "Multiple selection(table, memo)",
      action: "Ctrl + Drag, Ctrl + Click, Ctrl + A"
    },
    {
      name: "Multi-movement(table, memo)",
      action: "Ctrl + Drag"
    },
    {
      name: "Column shift",
      action: "Drag"
    },
    {
      name: "Multiple selection(column)",
      action: "Ctrl + Click, Shift + Click, Shift + Arrow key(up, down)"
    },
    {
      name: "Copy&Paste(column)",
      action: "Ctrl + C, Ctrl + V"
    },
    {
      name: "Contextmenu",
      action: "Right-click"
    },
    {
      name: "New Table",
      action: "Alt + N"
    },
    {
      name: "New Memo",
      action: "Alt + M"
    },
    {
      name: "New Column",
      action: "Alt + Enter"
    },
    {
      name: "Delete(table, memo)",
      action: "Ctrl + Delete"
    },
    {
      name: "Delete(column)",
      action: "Alt + Delete"
    },
    {
      name: "Select DataType Hint",
      action: "Arrow key(right), Click"
    },
    {
      name: "Move Data Type Hint",
      action: "Arrow key(up, down)"
    },
    {
      name: "Relationship ZeroOne",
      action: "Alt + 1"
    },
    {
      name: "Relationship ZeroOneN",
      action: "Alt + 2"
    },
    {
      name: "Primary Key",
      action: "Alt + K"
    },
    {
      name: "Undo",
      action: "Ctrl + Z"
    },
    {
      name: "Redo",
      action: "Ctrl + Shift + Z"
    },
    {
      name: "Editing",
      action: "Enter, dblclick"
    },
    {
      name: "All Action Stop",
      action: "ESC"
    }
  ];

  get helpStyle(): string {
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
      if (!el.closest(".erd-help-box")) {
        this.$emit("close");
      }
    }
  }

  private onTouchstart(event: TouchEvent) {
    event.stopPropagation();
    const el = event.target as HTMLElement;
    if (el) {
      if (!el.closest(".erd-help-box")) {
        this.$emit("close");
      }
    }
  }
}
</script>

<style scoped lang="scss">
.erd-help {
  position: absolute;
  z-index: 100000003;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);

  .erd-help-box {
    position: absolute;
    background-color: black;
    width: 700px;
    height: 615px;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    padding: 20px;
    box-sizing: border-box;

    .erd-help-close {
      float: right;
    }

    .erd-help-head {
      margin-bottom: 20px;

      .erd-help-name {
        width: 40%;
        display: inline-block;
      }

      .erd-help-action {
        width: 55%;
        display: inline-block;
      }
    }

    .erd-help-body {
      margin-bottom: 5px;

      .erd-help-name {
        width: 40%;
        display: inline-block;
      }

      .erd-help-action {
        width: 60%;
        display: inline-block;
      }
    }
  }
}
</style>
