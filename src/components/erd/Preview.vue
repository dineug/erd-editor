<template lang="pug">
  .preview(:style="previewStyle")
    .preview-canvas
      Table(
        v-for="table in tables"
        :key="table.id"
        :store="store"
        :table="table"
      )
      Memo(
        v-for="memo in memos"
        :key="memo.id"
        :memo="memo"
      )
      svg.canvas-svg(
        v-if="show.relationship"
        :style="canvasStyle"
      )
        Relationship(
          v-for="relationship in relationships"
          :key="relationship.id"
          :relationship="relationship"
        )
</template>

<script lang="ts">
  import {SIZE_PREVIEW_WIDTH, SIZE_TOP_MENU_HEIGHT} from '@/ts/layout';
  import {Table as TableModel} from '@/store/table';
  import {Memo as MemoModel} from '@/store/memo';
  import {Relationship as RelationshipModel} from '@/store/relationship';
  import {Show} from '@/store/canvas';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Preview/Table.vue';
  import Memo from './Preview/Memo.vue';
  import Relationship from './Preview/Relationship.vue';

  const MARGIN = 20;
  const MARGIN_TOP = SIZE_TOP_MENU_HEIGHT + MARGIN;

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
    },
  })
  export default class Preview extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;

    get tables(): TableModel[] {
      return this.store.tableStore.state.tables;
    }

    get memos(): MemoModel[] {
      return this.store.memoStore.state.memos;
    }

    get relationships(): RelationshipModel[] {
      return this.store.relationshipStore.state.relationships;
    }

    get previewStyle(): string {
      const ratio = this.store.canvasStore.getters.previewRatio;
      const option = this.store.canvasStore.state;
      const x = (-1 * option.width / 2) + (SIZE_PREVIEW_WIDTH / 2);
      const y = (-1 * option.height / 2) + (option.height * ratio / 2);
      const left = x - SIZE_PREVIEW_WIDTH - MARGIN + this.width + option.scrollLeft;
      const top = y + MARGIN_TOP + option.scrollTop;
      return `
        transform: scale(${ratio}, ${ratio});
        width: ${option.width}px;
        height: ${option.height}px;
        left: ${left}px;
        top: ${top}px;
      `;
    }

    get show(): Show {
      return this.store.canvasStore.state.show;
    }

    get canvasStyle(): string {
      const option = this.store.canvasStore.state;
      return `
        width: ${option.width}px;
        height: ${option.height}px;
      `;
    }

  }
</script>

<style scoped lang="scss">
  .preview {
    position: absolute;
    z-index: 100000000;
    overflow: hidden;
    background-color: $color-canvas;
    box-shadow: 5px 5px 30px 10px $color-preview-shadow;

    .preview-canvas {
      position: relative;

      .canvas-svg {
        position: absolute;
        z-index: 1;
      }
    }
  }
</style>
