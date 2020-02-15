<template lang="pug">
  .erd(
    :style="erdStyle"
    @mousedown="onMousedownERD"
    @touchstart="onTouchstartERD"
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
      :width="width"
      :height="height"
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
    Contextmenu.contextmenu-erd(
      v-if="canvasType === 'SQL' && contextmenu"
      :store="store"
      :menus="sqlMenus"
      :x="contextmenuX"
      :y="contextmenuY"
    )
    SQL(
      v-if="canvasType === 'SQL'"
      :store="store"
    )
    TableList(
      v-if="canvasType === 'List'"
      :store="store"
    )
    Contextmenu.contextmenu-erd(
      v-if="canvasType === 'GeneratorCode' && contextmenu"
      :store="store"
      :menus="codeMenus"
      :x="contextmenuX"
      :y="contextmenuY"
    )
    GeneratorCode(
      v-if="canvasType === 'GeneratorCode'"
      :store="store"
    )
    ImportErrorDDL(
      v-if="importErrorDDL"
      :store="store"
      :message="importErrorMessage"
      @close="onImportErrorDDLEnd"
    )
    Visualization(
      v-if="canvasType === 'Visualization'"
      :store="store"
      :width="width"
      :height="height"
    )
</template>

<script lang="ts">
import "@/plugins/fontawesome";

import { SIZE_MENU_HEIGHT } from "@/ts/layout";
import { Bus } from "@/ts/EventBus";
import { CanvasType, Commit as CanvasCommit } from "@/store/canvas";
import { Commit as TableCommit } from "@/store/table";
import { Commit as MemoCommit } from "@/store/memo";
import {
  Commit as RelationshipCommit,
  RelationshipDraw as RelationshipDrawModel,
  RelationshipType
} from "@/store/relationship";
import { addSpanText, log, removeSpanText } from "@/ts/util";
import Key from "@/models/Key";
import StoreManagement from "@/store/StoreManagement";
import Menu from "@/models/Menu";
import { dataMenu, dataMenuCode } from "@/data/contextmenu";
import icon from "@/ts/icon";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import Canvas from "./Canvas.vue";
import MultipleSelect from "./MultipleSelect.vue";
import Contextmenu from "./Contextmenu.vue";
import RelationshipDraw from "./RelationshipDraw.vue";
import Preview from "./Preview.vue";
import PreviewTarget from "./PreviewTarget.vue";
import TopMenu from "./TopMenu.vue";
import SQL from "./SQL.vue";
import TableList from "./TableList.vue";
import GeneratorCode from "./GeneratorCode.vue";
import ImportErrorDDL from "./ImportErrorDDL.vue";
import Visualization from "./Visualization.vue";

import { fromEvent, Observable, Subscription } from "rxjs";

@Component({
  name: "ERD",
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
    GeneratorCode,
    ImportErrorDDL,
    Visualization
  }
})
export default class ERD extends Vue {
  @Prop({ type: String, default: "" })
  private value!: string;
  @Prop({ type: Number, default: 0 })
  private width!: number;
  @Prop({ type: Number, default: 0 })
  private height!: number;
  @Prop({ type: Boolean, default: false })
  private focus!: boolean;
  @Prop({ type: Boolean, default: false })
  private undo!: boolean;
  @Prop({ type: Boolean, default: false })
  private redo!: boolean;

  private resize$: Observable<Event> = fromEvent(window, "resize");
  private mousedown$: Observable<MouseEvent> = fromEvent<MouseEvent>(
    window,
    "mousedown"
  );
  private mouseup$: Observable<MouseEvent> = fromEvent<MouseEvent>(
    window,
    "mouseup"
  );
  private mousemove$: Observable<MouseEvent> = fromEvent<MouseEvent>(
    window,
    "mousemove"
  );
  private keydown$: Observable<KeyboardEvent> = fromEvent<KeyboardEvent>(
    window,
    "keydown"
  );
  private touchmove$: Observable<TouchEvent> = fromEvent<TouchEvent>(
    window,
    "touchmove"
  );
  private touchend$: Observable<TouchEvent> = fromEvent<TouchEvent>(
    window,
    "touchend"
  );
  private subResize!: Subscription;
  private subMousedown!: Subscription;
  private subMouseup: Subscription | null = null;
  private subMousemove: Subscription | null = null;
  private subKeydown!: Subscription;
  private subTouchmove: Subscription | null = null;
  private subTouchend: Subscription | null = null;

  private store: StoreManagement = new StoreManagement();
  private currentValue: string = "";

  private contextmenu$!: Observable<MouseEvent>;
  private subContextmenu!: Subscription;
  private contextmenu: boolean = false;
  private contextmenuX: number = 0;
  private contextmenuY: number = 0;
  private windowWidth: number = window.innerWidth;
  private windowHeight: number = window.innerHeight;
  private touchX: number = 0;
  private touchY: number = 0;

  private select: boolean = false;
  private selectX: number = 0;
  private selectY: number = 0;
  private selectGhostX: number = 0;
  private selectGhostY: number = 0;

  private menus: Menu[] = dataMenu(this.store);
  private codeMenus: Menu[] = dataMenuCode(this.store);

  private importErrorDDL: boolean = false;
  private importErrorMessage: string = "";

  get erdStyle(): string {
    let style = `
        width: ${this.width}px;
        height: ${this.height}px;
      `;
    if (this.store.relationshipStore.state.draw) {
      const relationshipType = this.store.relationshipStore.state.draw
        .relationshipType;
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

  get sqlMenus(): Menu[] {
    let menus: Menu[] = [];
    for (const menu of this.menus) {
      if (menu.name === "Database" && menu.children) {
        menus = menu.children;
        break;
      }
    }
    return menus;
  }

  @Watch("value")
  private watchValue(value: string) {
    log.debug("ERD watchValue");
    if (value.trim() === "") {
      this.store.init();
      this.currentValue = this.store.value;
      this.$emit("change", this.currentValue);
    } else if (this.currentValue !== value) {
      this.store.load(value);
    }
    this.onScroll();
  }

  // ==================== Event Handler ===================
  private onChange() {
    log.debug("ERD onChange");
    this.currentValue = this.store.value;
    this.$emit("change", this.currentValue);
  }

  private onInput() {
    log.debug("ERD onInput");
    this.currentValue = this.store.value;
    this.$emit("input", this.currentValue);
  }

  private onScroll() {
    log.debug("ERD onScroll");
    this.$nextTick(() => {
      this.$el.scrollLeft = this.store.canvasStore.state.scrollLeft;
      this.$el.scrollTop = this.store.canvasStore.state.scrollTop;
    });
  }

  private onMousedownERD(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (
      this.canvasType === CanvasType.ERD &&
      !event.ctrlKey &&
      !el.closest(".contextmenu-erd") &&
      !el.closest(".table") &&
      !el.closest(".memo") &&
      !el.closest(".preview") &&
      !el.closest(".preview-target") &&
      !el.closest(".workspace-sql")
    ) {
      this.onMouseup(event);
      this.subMouseup = this.mouseup$.subscribe(this.onMouseup);
      this.subMousemove = this.mousemove$.subscribe(this.onMousemove);
      this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
      this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
    } else if (
      this.canvasType === CanvasType.ERD &&
      event.ctrlKey &&
      !el.closest(".contextmenu-erd") &&
      !el.closest(".table") &&
      !el.closest(".memo") &&
      !el.closest(".preview") &&
      !el.closest(".preview-target") &&
      !el.closest(".workspace-sql")
    ) {
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
    if (!el.closest(".contextmenu-erd")) {
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
    let movementX = event.movementX / window.devicePixelRatio;
    let movementY = event.movementY / window.devicePixelRatio;
    // firefox
    if (window.navigator.userAgent.toLowerCase().indexOf("firefox") !== -1) {
      movementX = event.movementX;
      movementY = event.movementY;
    }
    this.$el.scrollTop -= movementY;
    this.$el.scrollLeft -= movementX;
    this.store.canvasStore.commit(CanvasCommit.canvasMove, {
      scrollTop: this.$el.scrollTop,
      scrollLeft: this.$el.scrollLeft
    });
  }

  private onTouchstartERD(event: TouchEvent) {
    const el = event.target as HTMLElement;
    if (
      this.canvasType === CanvasType.ERD &&
      !el.closest(".contextmenu-erd") &&
      !el.closest(".table") &&
      !el.closest(".memo") &&
      !el.closest(".preview") &&
      !el.closest(".preview-target") &&
      !el.closest(".workspace-sql")
    ) {
      this.touchX = event.touches[0].clientX;
      this.touchY = event.touches[0].clientY;
      this.subTouchend = this.touchend$.subscribe(this.onTouchend);
      this.subTouchmove = this.touchmove$.subscribe(this.onTouchmove);
    }
  }

  private onTouchend(event: TouchEvent) {
    if (this.subTouchend && this.subTouchmove) {
      this.subTouchend.unsubscribe();
      this.subTouchmove.unsubscribe();
    }
  }

  private onTouchmove(event: TouchEvent) {
    const movementX = event.touches[0].clientX - this.touchX;
    const movementY = event.touches[0].clientY - this.touchY;
    this.touchX = event.touches[0].clientX;
    this.touchY = event.touches[0].clientY;
    this.$el.scrollTop -= movementY;
    this.$el.scrollLeft -= movementX;
    this.store.canvasStore.commit(CanvasCommit.canvasMove, {
      scrollTop: this.$el.scrollTop,
      scrollLeft: this.$el.scrollLeft
    });
  }

  private onKeydown(event: KeyboardEvent) {
    // log.debug(`ERD onKeydown: ${event.key}`);
    if (this.focus) {
      if (event.key === Key.Escape) {
        // Escape
        this.store.eventBus.$emit(Bus.TopMenu.helpStop);
        this.onImportErrorDDLEnd();
      }
      if (this.canvasType === CanvasType.ERD) {
        if (event.key === Key.Escape) {
          // Escape
          this.onContextmenuEnd();
          this.onSelectEnd();
          this.store.relationshipStore.commit(
            RelationshipCommit.relationshipDrawStop
          );
          this.store.tableStore.commit(TableCommit.tableSelectAllEnd);
          this.store.memoStore.commit(MemoCommit.memoSelectAllEnd);
          this.store.tableStore.commit(TableCommit.columnDraggableEnd);
        } else if (event.altKey && event.code === Key.KeyN) {
          // Alt + N
          this.store.tableStore.commit(TableCommit.tableAdd, this.store);
        } else if (event.altKey && event.code === Key.KeyM) {
          // Alt + M
          this.store.memoStore.commit(MemoCommit.memoAdd, this.store);
        } else if (event.altKey && event.key === Key.Enter) {
          // Alt + Enter
          this.store.tableStore.commit(TableCommit.columnAddAll, this.store);
          this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
        } else if (event.ctrlKey && event.code === Key.KeyA) {
          // Ctrl + A
          event.preventDefault();
          this.store.tableStore.commit(TableCommit.tableSelectAll);
          this.store.memoStore.commit(MemoCommit.memoSelectAll);
        } else if (event.ctrlKey && event.key === Key.Delete) {
          // Ctrl + Delete
          this.store.tableStore.commit(TableCommit.tableRemoveAll, this.store);
          this.store.memoStore.commit(MemoCommit.memoRemoveAll, this.store);
        } else if (event.altKey && event.key === Key.Delete) {
          // Alt + Delete
          this.store.tableStore.commit(TableCommit.columnRemoveAll, this.store);
          this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
        } else if (event.altKey && event.code === Key.KeyK) {
          // Alt + K
          this.store.tableStore.commit(TableCommit.columnPrimaryKey);
        } else if (event.altKey && event.code === Key.Digit1) {
          // Alt + 1
          this.store.relationshipStore.commit(
            RelationshipCommit.relationshipDrawStart,
            {
              store: this.store,
              relationshipType: RelationshipType.ZeroOne
            }
          );
        } else if (event.altKey && event.code === Key.Digit2) {
          // Alt + 2
          this.store.relationshipStore.commit(
            RelationshipCommit.relationshipDrawStart,
            {
              store: this.store,
              relationshipType: RelationshipType.ZeroOneN
            }
          );
        } else if (
          event.ctrlKey &&
          event.code === Key.KeyC &&
          !this.store.tableStore.state.edit
        ) {
          // Ctrl + C
          this.store.tableStore.commit(TableCommit.columnCopy);
        } else if (
          event.ctrlKey &&
          event.code === Key.KeyV &&
          !this.store.tableStore.state.edit
        ) {
          // Ctrl + V
          this.store.tableStore.commit(TableCommit.columnPaste, this.store);
        } else if (event.ctrlKey && event.shiftKey && event.code === Key.KeyZ) {
          // Ctrl + Shift + Z
          event.preventDefault();
          this.onRedo();
        } else if (event.ctrlKey && event.code === Key.KeyZ) {
          // Ctrl + Z
          event.preventDefault();
          this.onUndo();
        }
      } else {
        if (event.key === Key.Escape) {
          this.onContextmenuEnd();
        }
      }
    }
  }

  private onSelectEnd() {
    this.select = false;
  }

  private onResize() {
    log.debug("ERD onResize");
    this.windowWidth = window.innerWidth;
    this.windowHeight = window.innerHeight;
  }

  private onContextmenu(event: MouseEvent) {
    log.debug("ERD onContextmenu");
    event.preventDefault();
    const el = event.target as HTMLElement;
    this.contextmenu = !!el.closest(".erd");
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
      this.$emit("undo");
    }
  }

  private onRedo() {
    if (this.redo) {
      this.$emit("redo");
    }
  }

  private onImportErrorDDLStart(message: string) {
    this.importErrorDDL = true;
    this.importErrorMessage = message;
  }

  private onImportErrorDDLEnd() {
    this.importErrorDDL = false;
  }

  // ==================== Event Handler END ===================

  // ==================== Life Cycle ====================
  private created() {
    log.debug("ERD created");
    this.store.eventBus.$on(Bus.ERD.change, this.onChange);
    this.store.eventBus.$on(Bus.ERD.input, this.onInput);
    this.store.eventBus.$on(Bus.ERD.scroll, this.onScroll);
    this.store.eventBus.$on(
      Bus.ERD.importErrorDDLStart,
      this.onImportErrorDDLStart
    );
  }

  private mounted() {
    log.debug("ERD mounted");
    addSpanText();
    this.contextmenu$ = fromEvent<MouseEvent>(this.$el, "contextmenu");
    this.subContextmenu = this.contextmenu$.subscribe(this.onContextmenu);
    this.subResize = this.resize$.subscribe(this.onResize);
    this.subMousedown = this.mousedown$.subscribe(this.onMousedown);
    this.subKeydown = this.keydown$.subscribe(this.onKeydown);
    this.store.eventBus.$on(Bus.ERD.contextmenuEnd, this.onContextmenuEnd);
  }

  private destroyed() {
    log.debug("ERD destroyed");
    removeSpanText();
    this.subContextmenu.unsubscribe();
    this.subResize.unsubscribe();
    this.subMousedown.unsubscribe();
    this.subKeydown.unsubscribe();
    this.store.eventBus.destroyed();
    this.store.destroyed();
  }

  // ==================== Life Cycle END ====================
}
</script>

<style lang="scss">
.erd {
  position: relative;
  z-index: 100;
  overflow: hidden;
  color: $color-font;
  background-color: $color-canvas;

  /* width */
  ::-webkit-scrollbar {
    width: $size-scrollbar;
    height: $size-scrollbar;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    background: $color-opacity;
  }

  ::-webkit-scrollbar-corner {
    background: $color-opacity;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: $color-scrollbar-thumb;
  }

  /* Handle : hover*/
  ::-webkit-scrollbar-thumb:hover {
    background: $color-scrollbar-thumb-active;
  }

  /* firefox */
  .scrollbar {
    scrollbar-color: $color-scrollbar-thumb $color-opacity;
    scrollbar-width: thin;
  }
}
</style>
