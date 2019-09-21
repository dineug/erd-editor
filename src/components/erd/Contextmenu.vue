<template lang="pug">
  .contextmenu
    ul(:style="`top: ${y}px; left: ${x}px;`" ref="ul")
      li(
        v-for="menu in menus"
        :key="menu.id"
        @click="onExecute(menu)"
        @mouseover="onMouseover(menu)"
      )
        span.icon
          img(v-if="getIcon(menu) && menu.base64" :src="getIcon(menu)")
          font-awesome-icon(v-else-if="getIcon(menu)" :icon="getIcon(menu)")
        span.name {{menu.name}}
        span.keymap {{menu.keymap}}
        span.arrow(v-if="menu.children")
          font-awesome-icon(icon="chevron-right")
    Contextmenu(
      v-if="currentMenu && currentMenu.children"
      :store="store"
      :menus="currentMenu.children"
      :x="childrenX"
      :y="childrenY"
    )
</template>

<script lang="ts">
  import {SIZE_MENU_HEIGHT} from '@/ts/layout';
  import StoreManagement from '@/store/StoreManagement';
  import Menu from '@/models/Menu';
  import {Bus} from '@/ts/EventBus';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Contextmenu extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Array, default: () => []})
    private menus!: Menu[];
    @Prop({type: Number, default: 0})
    private x!: number;
    @Prop({type: Number, default: 0})
    private y!: number;

    private windowHeight: number = window.innerHeight;
    private currentMenu: Menu | null = null;

    get childrenX(): number {
      const ul = this.$refs.ul as HTMLElement;
      return this.x + ul.clientWidth;
    }

    get childrenY(): number {
      if (this.currentMenu) {
        let y = this.y + this.menus.indexOf(this.currentMenu) * SIZE_MENU_HEIGHT;
        if (this.currentMenu.children) {
          const height = (this.currentMenu.children.length - 1) * SIZE_MENU_HEIGHT;
          if (y + height > this.windowHeight) {
            y -= height;
          }
        }
        return y;
      } else {
        return this.y;
      }
    }

    private getIcon(menu: Menu): string | undefined {
      if (menu.option && menu.option.show) {
        const show = this.store.canvasStore.state.show;
        return show[menu.option.show] ? 'check' : undefined;
      } else {
        return menu.icon;
      }
    }

    private onExecute(menu: Menu) {
      if (!menu.children && menu.execute && typeof menu.execute === 'function') {
        menu.execute();
        if (!menu.option || menu.option.close === undefined || menu.option.close) {
          this.store.eventBus.$emit(Bus.ERD.contextmenuEnd);
        }
      }
    }

    private onMouseover(menu: Menu) {
      this.currentMenu = menu;
    }

  }
</script>

<style scoped lang="scss">
  $size-icon: 16px;
  $size-name: 110px;
  $size-keymap: 50px;

  .contextmenu {

    ul {
      position: fixed;
      z-index: 8000;
      background-color: $color-table;
      opacity: 0.9;

      li {
        padding: 10px;
        cursor: pointer;
        font-size: $size-font + 2;
        white-space: nowrap;
        color: $color-font;

        &:hover {
          color: $color-font-active;
          background-color: $color-contextmenu-active;
        }

        span {
          display: inline-flex;
          vertical-align: middle;
          align-items: center;
          overflow: hidden;
          padding-right: 10px;
        }

        .icon {
          width: $size-icon;

          img {
            width: $size-icon;
          }
        }

        .name {
          width: $size-name;
        }

        .keymap {
          width: $size-keymap;
          display: inline-block;
          padding-right: 0;
        }

        .arrow {
          width: 100%;
          padding-right: 0;
        }
      }
    }
  }

  ul, ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
