<template lang="pug">
  .sql
</template>

<script lang="ts">
import monaco from '@/plugins/monaco-editor'
import { Commit as CanvasCommit } from '@/store/canvas'
import StoreManagement from '@/store/StoreManagement'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class SQL extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: String, default: ''})
  private value!: string

  private mounted () {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0
      this.$el.parentElement.scrollLeft = 0
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: this.$el.parentElement.scrollTop,
        scrollLeft: this.$el.parentElement.scrollLeft
      })
    }

    monaco.editor.create(this.$el as HTMLElement, {
      value: this.value,
      language: 'sql',
      theme: 'vs-dark',
      automaticLayout: true
    })
  }
}
</script>

<style scoped lang="scss">
  .sql {
    margin-top: $size-top-menu-height;
    height: calc(100% - 30px);
  }
</style>
