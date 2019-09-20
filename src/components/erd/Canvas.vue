<template lang="pug">
  .canvas(
    :style="`width: ${option.width}px; height: ${option.height}px;`"
  )
    Contextmenu.contextmenu-erd(
      v-if="contextmenu"
      :store="store"
      :x="contextmenuX"
      :y="contextmenuY"
    )
    Table(
      v-for="table in tables"
      :key="table.id"
      :store="store"
      :focus="focus"
      :table="table"
    )
    Memo(
      v-for="memo in memos"
      :key="memo.id"
      :store="store"
      :memo="memo"
    )
</template>

<script lang="ts">
  import {State} from '@/store/canvas';
  import {Table as TableModel} from '@/store/table';
  import {Memo as MemoModel} from '@/store/memo';
  import {log} from '@/ts/util';
  import StoreManagement from '@/store/StoreManagement';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Table from './Table.vue';
  import Memo from './Memo.vue';
  import Relationship from './Relationship.vue';
  import Contextmenu from './Contextmenu.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  @Component({
    components: {
      Table,
      Memo,
      Relationship,
      Contextmenu,
    },
  })
  export default class Canvas extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Boolean, default: false})
    private focus!: boolean;

    private mousedown$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousedown');
    private subMousedown!: Subscription;
    private subContextmenu!: Subscription;
    private contextmenu: boolean = false;
    private contextmenuX: number = 0;
    private contextmenuY: number = 0;

    get option(): State {
      return this.store.canvasStore.state;
    }

    get tables(): TableModel[] {
      return this.store.tableStore.state.tables;
    }

    get memos(): MemoModel[] {
      return this.store.memoStore.state.memos;
    }

    // ==================== Event Handler ===================
    private onMousedown(event: MouseEvent) {
      log.debug('Canvas onMousedown');
      if (event.target) {
        const el = event.target as HTMLElement;
        if (!el.closest('.contextmenu-erd')) {
          this.contextmenu = false;
        }
      }
    }

    private onContextmenu(event: MouseEvent) {
      log.debug('Canvas onContextmenu');
      event.preventDefault();
      if (event.target) {
        const el = event.target as HTMLElement;
        this.contextmenu = !!el.closest('.canvas');
        if (this.contextmenu) {
          this.contextmenuX = event.clientX;
          this.contextmenuY = event.clientY;
        }
      }
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private mounted() {
      this.subMousedown = this.mousedown$.subscribe(this.onMousedown);
      this.subContextmenu = fromEvent<MouseEvent>(this.$el, 'contextmenu').subscribe(this.onContextmenu);
    }

    private destroyed() {
      this.subMousedown.unsubscribe();
      this.subContextmenu.unsubscribe();
    }

    // ==================== Life Cycle END ====================
  }
</script>

<style scoped lang="scss">
  .canvas {
    position: relative;
    z-index: 200;
    background-color: $color-canvas;
  }
</style>
