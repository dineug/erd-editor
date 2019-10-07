<template lang="pug">
  .erd(
    :style="erdStyle"
    @mousedown="onMousedownERD"
  )
    TopMenu(
      :store="store"
      :width="width"
      :height="height"
      :undo="undo"
      :redo="redo"
      @undo="onUndo"
      @redo="onRedo"
    )
    Contextmenu.contextmenu-erd(
      v-if="canvasType === 'ERD' && contextmenu"
      :store="store"
      :menus="menus"
      :x="contextmenuX"
      :y="contextmenuY"
    )
    Canvas(
      v-if="canvasType === 'ERD'"
      :store="store"
      :focus="focus"
      ref="canvas"
    )
    RelationshipDraw(
      v-if="canvasType === 'ERD' && draw && draw.start"
      :store="store"
      :draw="draw"
    )
    MultipleSelect(
      v-if="canvasType === 'ERD' && select"
      :store="store"
      :x="selectX"
      :y="selectY"
      :ghostX="selectGhostX"
      :ghostY="selectGhostY"
      @selectEnd="onSelectEnd"
    )
    Preview(
      v-if="canvasType === 'ERD'"
      :store="store"
      :width="width"
      :height="height"
    )
    PreviewTarget(
      v-if="canvasType === 'ERD'"
      :store="store"
      :width="width"
      :height="height"
    )
    SQL(
      v-if="canvasType === 'SQL'"
      :store="store"
      :value="sql"
    )
    TableList(
      v-if="canvasType === 'List'"
      :store="store"
    )
</template>

<script lang="ts">
  import '@/plugins/fontawesome';

  import {SIZE_MENU_HEIGHT} from '@/ts/layout';
  import {Bus} from '@/ts/EventBus';
  import {CanvasType, Commit as CanvasCommit} from '@/store/canvas';
  import {Commit as TableCommit} from '@/store/table';
  import {Commit as MemoCommit} from '@/store/memo';
  import {
    Commit as RelationshipCommit,
    RelationshipDraw as RelationshipDrawModel,
    RelationshipType,
  } from '@/store/relationship';
  import {addSpanText, log, removeSpanText} from '@/ts/util';
  import Key from '@/models/Key';
  import StoreManagement from '@/store/StoreManagement';
  import Menu from '@/models/Menu';
  import {dataMenu} from '@/data/contextmenu';
  import icon from '@/ts/icon';
  import SQLFactory from '@/ts/SQL';
  import {Component, Prop, Vue, Watch} from 'vue-property-decorator';
  import Canvas from './Canvas.vue';
  import MultipleSelect from './MultipleSelect.vue';
  import Contextmenu from './Contextmenu.vue';
  import RelationshipDraw from './RelationshipDraw.vue';
  import Preview from './Preview.vue';
  import PreviewTarget from './PreviewTarget.vue';
  import TopMenu from './TopMenu.vue';
  import SQL from './SQL.vue';
  import TableList from './TableList.vue';

  import {fromEvent, Observable, Subscription} from 'rxjs';

  @Component({
    components: {
      Canvas,
      Contextmenu,
      MultipleSelect,
      RelationshipDraw,
      Preview,
      PreviewTarget,
      TopMenu,
      SQL,
      TableList,
    },
  })
  export default class ERD extends Vue {
    @Prop({type: String, default: ''})
    private value!: string;
    @Prop({type: Number, default: 0})
    private width!: number;
    @Prop({type: Number, default: 0})
    private height!: number;
    @Prop({type: Boolean, default: false})
    private focus!: boolean;
    @Prop({type: Boolean, default: false})
    private undo!: boolean;
    @Prop({type: Boolean, default: false})
    private redo!: boolean;

    private resize$: Observable<Event> = fromEvent(window, 'resize');
    private mousedown$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousedown');
    private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mouseup');
    private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousemove');
    private keydown$: Observable<KeyboardEvent> = fromEvent<KeyboardEvent>(window, 'keydown');
    private subResize!: Subscription;
    private subMousedown!: Subscription;
    private subMouseup: Subscription | null = null;
    private subMousemove: Subscription | null = null;
    private subKeydown!: Subscription;

    private store: StoreManagement = new StoreManagement();
    private currentValue: string = '';

    private contextmenu$!: Observable<MouseEvent>;
    private subContextmenu!: Subscription;
    private contextmenu: boolean = false;
    private contextmenuX: number = 0;
    private contextmenuY: number = 0;
    private windowWidth: number = window.innerWidth;
    private windowHeight: number = window.innerHeight;

    private select: boolean = false;
    private selectX: number = 0;
    private selectY: number = 0;
    private selectGhostX: number = 0;
    private selectGhostY: number = 0;

    private menus: Menu[] = dataMenu(this.store);

    get erdStyle(): string {
      let style = `
        width: ${this.width}px;
        height: ${this.height}px;
      `;
      if (this.store.relationshipStore.state.draw) {
        const relationshipType = this.store.relationshipStore.state.draw.relationshipType;
        style += `cursor: url("${icon[relationshipType]}") 16 16, auto;`;
      }
      return style;
    }

    get draw(): RelationshipDrawModel | null {
      return this.store.relationshipStore.state.draw;
    }

    get canvasType(): CanvasType {
      return this.store.canvasStore.state.canvasType;
    }

    get sql(): string {
      return SQLFactory.toDDL(this.store);
    }

    @Watch('value')
    private watchValue(value: string) {
      log.debug('ERD watchValue');
      if (value.trim() === '') {
        this.store.init();
        this.currentValue = this.store.value;
        this.$emit('change', this.currentValue);
      } else if (this.currentValue !== value) {
        this.store.load(value);
      }
    }

    // ==================== Event Handler ===================
    private onChange() {
      log.debug('ERD onChange');
      this.currentValue = this.store.value;
      this.$emit('change', this.currentValue);
    }

    private onInput() {
      log.debug('ERD onInput');
      this.currentValue = this.store.value;
      this.$emit('input', this.currentValue);
    }

    private onMousedownERD(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!event.ctrlKey
        && !el.closest('.contextmenu-erd')
        && !el.closest('.table')
        && !el.closest('.memo')
        && !el.closest('.preview')
        && !el.closest('.preview-target')) {
        this.onMouseup(event);
        this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
        this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
        this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
        this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
      } else if (event.ctrlKey
        && !el.closest('.contextmenu-erd')
        && !el.closest('.table')
        && !el.closest('.memo')
        && !el.closest('.preview')
        && !el.closest('.preview-target')) {
        this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
        this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
        this.selectX = event.x;
        this.selectY = event.y;
        this.selectGhostX = event.offsetX;
        this.selectGhostY = event.offsetY;
        this.select = true;
      }
    }

    private onMousedown(event: MouseEvent) {
      const el = event.target as HTMLElement;
      if (!el.closest('.contextmenu-erd')) {
        this.contextmenu = false;
      }
    }

    private onMouseup(event: MouseEvent) {
      if (this.subMouseup && this.subMousemove) {
        this.subMouseup.unsubscribe();
        this.subMousemove.unsubscribe();
      }
    }

    private onMousemove(event: MouseEvent) {
      event.preventDefault();
      this.$el.scrollTop -= event.movementY;
      this.$el.scrollLeft -= event.movementX;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: this.$el.scrollTop,
        scrollLeft: this.$el.scrollLeft,
      });
    }

    private onKeydown(event: KeyboardEvent) {
      // log.debug('ERD onKeydown');
      if (this.focus) {
        if (this.canvasType === CanvasType.ERD) {
          if (event.altKey && event.code === Key.KeyN) { // Alt + N
            this.store.tableStore.commit(TableCommit.tableAdd, this.store);
          } else if (event.altKey && event.code === Key.KeyM) { // Alt + M
            this.store.memoStore.commit(MemoCommit.memoAdd, this.store);
          } else if (event.altKey && event.key === Key.Enter) { // Alt + Enter
            this.store.tableStore.commit(TableCommit.columnAddAll, this.store);
            this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
          } else if (event.ctrlKey && event.code === Key.KeyA) { // Ctrl + A
            event.preventDefault();
            this.store.tableStore.commit(TableCommit.tableSelectAll);
            this.store.memoStore.commit(MemoCommit.memoSelectAll);
          } else if (event.ctrlKey && event.key === Key.Delete) { // Ctrl + Delete
            this.store.tableStore.commit(TableCommit.tableRemoveAll, this.store);
            this.store.memoStore.commit(MemoCommit.memoRemoveAll, this.store);
          } else if (event.altKey && event.key === Key.Delete) { // Alt + Delete
            this.store.tableStore.commit(TableCommit.columnRemoveAll, this.store);
            this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
          } else if (event.altKey && event.code === Key.KeyK) { // Alt + K
            this.store.tableStore.commit(TableCommit.columnPrimaryKey);
          } else if (event.altKey && event.code === Key.Digit1) { // Alt + 1
            this.store.relationshipStore.commit(RelationshipCommit.relationshipDrawStart, {
              store: this.store,
              relationshipType: RelationshipType.ZeroOne,
            });
          } else if (event.altKey && event.code === Key.Digit2) { // Alt + 2
            this.store.relationshipStore.commit(RelationshipCommit.relationshipDrawStart, {
              store: this.store,
              relationshipType: RelationshipType.ZeroOneN,
            });
          } else if (event.ctrlKey && event.code === Key.KeyC && !this.store.tableStore.state.edit) { // Ctrl + C
            this.store.tableStore.commit(TableCommit.columnCopy);
          } else if (event.ctrlKey && event.code === Key.KeyV && !this.store.tableStore.state.edit) { // Ctrl + V
            this.store.tableStore.commit(TableCommit.columnPaste, this.store);
          } else if (event.ctrlKey && event.shiftKey && event.code === Key.KeyZ) { // Ctrl + Shift + Z
            event.preventDefault();
            this.onRedo();
          } else if (event.ctrlKey && event.code === Key.KeyZ) { // Ctrl + Z
            event.preventDefault();
            this.onUndo();
          }
        }
      }
    }

    private onSelectEnd() {
      this.select = false;
    }

    private onResize() {
      log.debug('ERD onResize');
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    }

    private onContextmenu(event: MouseEvent) {
      log.debug('ERD onContextmenu');
      event.preventDefault();
      const el = event.target as HTMLElement;
      this.contextmenu = !!el.closest('.erd');
      if (this.contextmenu) {
        this.contextmenuX = event.x;
        this.contextmenuY = event.y;
        const height = this.menus.length * SIZE_MENU_HEIGHT;
        if (event.y + height > this.windowHeight) {
          this.contextmenuY = event.y - height;
        } else {
          this.contextmenuY = event.y;
        }
      }
    }

    private onContextmenuEnd() {
      this.contextmenu = false;
    }

    private onUndo() {
      if (this.undo) {
        this.$emit('undo');
      }
    }

    private onRedo() {
      if (this.redo) {
        this.$emit('redo');
      }
    }

    // ==================== Event Handler END ===================

    // ==================== Life Cycle ====================
    private created() {
      log.debug('ERD created');
      this.store.eventBus.$on(Bus.ERD.change, this.onChange);
      this.store.eventBus.$on(Bus.ERD.input, this.onInput);
    }

    private mounted() {
      log.debug('ERD mounted');
      addSpanText();
      this.contextmenu$ = fromEvent<MouseEvent>(this.$el, 'contextmenu');
      this.subContextmenu = this.contextmenu$.subscribe(this.onContextmenu);
      this.subResize = this.resize$.subscribe(this.onResize);
      this.subMousedown = this.mousedown$.subscribe(this.onMousedown);
      this.subKeydown = this.keydown$.subscribe(this.onKeydown);
      this.store.eventBus.$on(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
    }

    private destroyed() {
      log.debug('ERD destroyed');
      removeSpanText();
      this.subContextmenu.unsubscribe();
      this.subResize.unsubscribe();
      this.subMousedown.unsubscribe();
      this.subKeydown.unsubscribe();
      this.store.eventBus.destroyed();
    }

    // ==================== Life Cycle END ====================
  }
</script>

<style scoped lang="scss">
  .erd {
    position: relative;
    z-index: 100;
    overflow: hidden;
  }
</style>
