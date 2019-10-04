<template lang="pug">
  .preview-target(
    :style="previewStyle"
    @mousedown="onMousedown"
  )
</template>

<script lang="ts">
  import {SIZE_PREVIEW_WIDTH, SIZE_TOP_MENU_HEIGHT} from '@/ts/layout';
  import {Commit as CanvasCommit} from '@/store/canvas';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  const MARGIN = 20;
  const MARGIN_TOP = SIZE_TOP_MENU_HEIGHT + MARGIN;

  @Component
  export default class PreviewTarget extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;

    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;

    get previewStyle(): string {
      const ratio = this.store.canvasStore.getters.previewRatio;
      const option = this.store.canvasStore.state;
      const x = option.scrollLeft * ratio;
      const y = option.scrollTop * ratio;
      const left = this.width - SIZE_PREVIEW_WIDTH - MARGIN + option.scrollLeft + x;
      const top = MARGIN_TOP + option.scrollTop + y;
      return `
        width: ${this.width * ratio}px;
        height: ${this.height * ratio}px;
        left: ${left}px;
        top: ${top}px;
      `;
    }

    private onMousedown() {
      this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
      this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      if (this.$el.parentElement) {
        const ratio = this.store.canvasStore.getters.previewRatio;
        this.$el.parentElement.scrollTop += event.movementY / ratio;
        this.$el.parentElement.scrollLeft += event.movementX / ratio;
        this.store.canvasStore.commit(CanvasCommit.canvasMove, {
          scrollTop: this.$el.parentElement.scrollTop,
          scrollLeft: this.$el.parentElement.scrollLeft,
        });
      }
    }
  }
</script>

<style scoped lang="scss">
  .preview-target {
    position: absolute;
    z-index: 100000001;
    border: solid $color-preview-target 1px;
    cursor: pointer;
  }
</style>
