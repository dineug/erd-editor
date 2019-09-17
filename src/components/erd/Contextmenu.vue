<template lang="pug">
  .contextmenu
    ul(:style="`top: ${y}px; left: ${x}px;`")
      li(
        v-for="menu in menus"
        :key="menu.id"
        @click="menu.execute"
      )
        span.icon
          img(v-if="menu.base64" :src="menu.icon")
          font-awesome-icon(v-else :icon="menu.icon")
        span.name {{menu.name}}
        span.keymap {{menu.keymap}}
</template>

<script lang="ts">
  import {uuid} from '@/ts/util';
  import icon from '@/ts/icon';
  import tableStore, {Commit as TableCommit} from '@/store/table';
  import memoStore, {Commit as MemoCommit} from '@/store/memo';
  import {log} from '@/ts/util';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  interface Menu {
    readonly id: string;
    name: string;
    keymap: string;
    icon: string;
    base64?: boolean;

    execute(): void;
  }

  @Component
  export default class Contextmenu extends Vue {
    @Prop({type: Number, default: 0})
    private x!: number;
    @Prop({type: Number, default: 0})
    private y!: number;

    private menus: Menu[] = [
      {
        id: uuid(),
        name: 'New Table',
        keymap: 'Alt + N',
        icon: 'table',
        execute() {
          tableStore.commit(TableCommit.tableAdd);
        },
      },
      {
        id: uuid(),
        name: 'New Memo',
        keymap: 'Alt + M',
        icon: 'sticky-note',
        execute() {
          memoStore.commit(MemoCommit.memoAdd);
        },
      },
      {
        id: uuid(),
        name: 'Primary Key',
        keymap: 'Alt + K',
        icon: 'key',
        execute() {
          log.debug('Primary Key');
        },
      },
      {
        id: uuid(),
        name: '1 : 1',
        keymap: 'Alt + 1',
        icon: icon['erd-0-1'],
        base64: true,
        execute() {
          log.debug('1 : 1');
        },
      },
      {
        id: uuid(),
        name: '1 : N',
        keymap: 'Alt + 2',
        icon: icon['erd-0-1-N'],
        base64: true,
        execute() {
          log.debug('1 : N');
        },
      },
    ];

  }
</script>

<style scoped lang="scss">
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
          width: 75px;
          display: inline-flex;
          vertical-align: middle;
          align-items: center;
          overflow: hidden;
        }

        .icon {
          width: 16px;

          img {
            width: 16px;
          }
        }

        .name {
          padding-left: 10px;
        }

        .keymap {
          width: 100%;
          display: inline;
          padding-left: 10px;
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
