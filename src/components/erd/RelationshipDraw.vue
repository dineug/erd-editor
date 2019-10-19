<template lang="pug">
  svg.relationship-draw(:style="svgStyle")
    g
      line(
        :x1="drawPath.path.line.start.x1"
        :y1="drawPath.path.line.start.y1"
        :x2="drawPath.path.line.start.x2"
        :y2="drawPath.path.line.start.y2"
        stroke="#dda8b1"
        stroke-width="3"
      )

      path(
        :d="drawPath.path.path.d()"
        stroke="#dda8b1"
        stroke-dasharray="10"
        stroke-width="3" fill="transparent"
      )

      line(
        :x1="drawPath.line.start.x1"
        :y1="drawPath.line.start.y1"
        :x2="drawPath.line.start.x2"
        :y2="drawPath.line.start.y2"
        stroke="#dda8b1"
        stroke-width="3"
      )
</template>

<script lang="ts">
import StoreManagement from "@/store/StoreManagement";
import {
  Commit,
  RelationshipDraw as RelationshipDrawModel
} from "@/store/relationship";
import { getDraw, DrawPath } from "@/store/relationship/relationshipHelper";
import { Component, Prop, Vue } from "vue-property-decorator";

import { fromEvent, Observable, Subscription } from "rxjs";

@Component
export default class RelationshipDraw extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Object, default: () => ({}) })
  private draw!: RelationshipDrawModel;

  private mousemoveParent$!: Observable<MouseEvent>;
  private subMousemoveParent!: Subscription;

  get svgStyle(): string {
    return `
        width: ${this.store.canvasStore.state.width}px;
        height: ${this.store.canvasStore.state.height}px;
      `;
  }

  get drawPath(): DrawPath {
    return getDraw(this.draw);
  }

  // ==================== Event Handler ===================
  private onMousemoveParent(event: MouseEvent) {
    event.preventDefault();
    const el = event.target as HTMLElement;
    if (
      !el.closest(".contextmenu-erd") &&
      !el.closest(".table") &&
      !el.closest(".memo")
    ) {
      this.store.relationshipStore.commit(Commit.relationshipDraw, {
        x: event.offsetX,
        y: event.offsetY
      });
    }
  }

  // ==================== Event Handler END ===================

  // ==================== Life Cycle ====================
  private mounted() {
    if (this.$el.parentElement) {
      this.mousemoveParent$ = fromEvent<MouseEvent>(
        this.$el.parentElement,
        "mousemove"
      );
      this.subMousemoveParent = this.mousemoveParent$.subscribe(
        this.onMousemoveParent
      );
    }
  }

  private destroyed() {
    this.subMousemoveParent.unsubscribe();
  }

  // ==================== Life Cycle END ====================
}
</script>

<style scoped lang="scss">
.relationship-draw {
  position: absolute;
  top: 0;
}
</style>
