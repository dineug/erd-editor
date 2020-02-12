<template lang="pug">
  svg.mdi(
    viewBox="0 0 24 24"
    :style="svgStyle"
  )
    path(:d="path" :fill="fill")
</template>

<script lang="ts">
import mdi from "@/ts/mdi";
import { Component, Prop, Vue } from "vue-property-decorator";

const SIZE = 24;
const SIZE_REM = 1.5;

@Component
export default class MDIcon extends Vue {
  @Prop({ type: Number, default: SIZE })
  private size!: number;
  @Prop({ type: String, default: "" })
  private color!: string;

  private path: string = "";

  get rem(): number {
    return SIZE_REM * (this.size / SIZE);
  }

  get svgStyle(): string {
    return `
        width: ${this.rem}rem;
        height: ${this.rem}rem;
      `;
  }

  get fill(): string {
    if (this.color !== "") {
      return this.color;
    }
    return "#969696";
  }

  private mdiKey(name: string): string {
    const list = name.split("-");
    for (let i = 1; i < list.length; i++) {
      list[i] = list[i].charAt(0).toUpperCase() + list[i].slice(1);
    }
    return list.join("");
  }

  private setMdi() {
    if (this.$slots.default && this.$slots.default[0].text) {
      const key = this.mdiKey(this.$slots.default[0].text);
      this.path = mdi[key];
    }
  }

  private created() {
    this.setMdi();
  }

  private updated() {
    this.setMdi();
  }
}
</script>

<style scoped lang="scss">
.mdi {
  vertical-align: middle;
}
</style>
