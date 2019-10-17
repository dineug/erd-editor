<template lang="pug">
  .sash(
    :class="{ vertical: vertical, horizontal: horizontal, edge: edge }"
    :style="sashStyle"
    @mousedown="onMousedown"
  )
</template>

<script lang="ts">
import { SIZE_SASH } from '@/ts/layout'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { fromEvent, Observable, Subscription } from 'rxjs'

@Component
export default class Sash extends Vue {
  @Prop({type: Boolean, default: false})
  private vertical!: boolean
  @Prop({type: Boolean, default: false})
  private horizontal!: boolean
  @Prop({type: Boolean, default: false})
  private edge!: boolean
  @Prop({type: String, default: 'move'})
  private edgeCursor!: boolean
  @Prop({type: Number, default: 0})
  private top!: number
  @Prop({type: Number, default: 0})
  private left!: number

  private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup')
  private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove')
  private subMouseup: Subscription | null = null
  private subMousemove: Subscription | null = null

  get centerTop () {
    return this.top === 0 && !this.horizontal && !this.edge
      ? this.top
      : this.top - (SIZE_SASH / 2)
  }

  get centerLeft () {
    return this.left === 0 && !this.vertical && !this.edge
      ? this.left
      : this.left - (SIZE_SASH / 2)
  }

  get sashStyle (): string {
    if (this.edge) {
      return `
          top: ${this.centerTop}px;
          left: ${this.centerLeft}px;
          cursor: ${this.edgeCursor};
        `
    }
    return `
        top: ${this.centerTop}px;
        left: ${this.centerLeft}px;
      `
  }

  // ==================== Event Handler ===================
  private onMousedown (event: MouseEvent) {
    this.subMouseup = this.mouseup$.subscribe(this.onMouseup)
    this.subMousemove = this.mousemove$.subscribe(this.onMousemove)
    this.$emit('mousedown', event)
  }

  private onMouseup (event: MouseEvent) {
    if (this.subMouseup && this.subMousemove) {
      this.subMouseup.unsubscribe()
      this.subMousemove.unsubscribe()
    }
    this.$emit('mouseup', event)
  }

  private onMousemove (event: MouseEvent) {
    event.preventDefault()
    this.$emit('mousemove', event)
  }

  // ==================== Event Handler END ===================
}
</script>

<style scoped lang="scss">
  .sash {
    position: absolute;
    z-index: 1000;

    &.edge {
      width: $size-sash;
      height: $size-sash;
    }

    &.vertical {
      width: $size-sash;
      height: 100%;
      cursor: ew-resize;
    }

    &.horizontal {
      width: 100%;
      height: $size-sash;
      cursor: ns-resize;
    }
  }
</style>
