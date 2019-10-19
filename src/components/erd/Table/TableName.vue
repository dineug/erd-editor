<template lang="pug">
  input(
    v-if="edit"
    v-focus
    v-model="table.name"
    :style="`width: ${width}px;`"
    spellcheck="false"
    @input="onInput"
    @blur="onBlur"
  )
  .table-name(
    v-else
    :class="{focus, placeholder}"
    :style="`width: ${width}px;`"
    @mousedown="onMousedown"
    @dblclick="onDblclick"
  )
    span {{value}}
</template>

<script lang="ts">
import { Table } from "@/store/table";
import { TableFocus } from "@/models/TableFocusModel";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
  directives: {
    focus: {
      inserted(el: HTMLElement) {
        el.focus();
      }
    }
  }
})
export default class TableName extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private table!: Table;
  @Prop({ type: Object, default: null })
  private tableFocus!: TableFocus | null;
  @Prop({ type: Boolean, default: false })
  private edit!: boolean;
  @Prop({ type: Number, default: 0 })
  private width!: number;

  get focus(): boolean {
    let result = false;
    if (
      this.tableFocus &&
      this.tableFocus.id === this.table.id &&
      this.tableFocus.focusName
    ) {
      result = true;
    }
    return result;
  }

  get placeholder(): boolean {
    let result = false;
    if (this.table.name.trim() === "") {
      result = true;
    }
    return result;
  }

  get value(): string {
    let value = "table";
    if (this.table.name.trim() !== "") {
      value = this.table.name;
    }
    return value;
  }

  private onInput(event: Event) {
    this.$emit("input", event);
  }

  private onBlur(event: Event) {
    this.$emit("blur", event);
  }

  private onMousedown(event: MouseEvent) {
    this.$emit("mousedown", event);
  }

  private onDblclick(event: MouseEvent) {
    this.$emit("dblclick", event);
  }
}
</script>

<style scoped lang="scss">
.table-name {
}
</style>
