<template lang="pug">
  transition-group.data-type-hint(
    tag="ul"
    name="hint"
  )
    li(
      v-for="hint in hints"
      :key="hint.name"
      :class="{active: hint.active}"
      v-html="hint.html"
      @click="onClick(hint)"
    )
</template>

<script lang="ts">
import { Column } from '@/store/table'
import { DataTypeHint as DataTypeHintModel } from '@/data/dataType'
import StoreManagement from '@/store/StoreManagement'
import { markToHTML, log } from '@/ts/util'
import { Bus } from '@/ts/EventBus'
import { Component, Prop, Watch, Vue } from 'vue-property-decorator'

import { fromEvent, Observable, Subscription } from 'rxjs'

interface Hint {
  name: string
  html: string
  active: boolean
}

@Component
export default class DataTypeHint extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: Object, default: () => ({})})
  private column!: Column

  private hints: Hint[] = []
  private stop: boolean = false
  private mousedown$: Observable<MouseEvent> = fromEvent<MouseEvent>(window, 'mousedown')
  private subMousedown!: Subscription

  get typeHint (): DataTypeHintModel[] {
    return this.store.canvasStore.getters.typeHint
  }

  get activeIndex (): number | null {
    let index: number | null = null
    const len = this.hints.length
    for (let i = 0; i < len; i++) {
      if (this.hints[i].active) {
        index = i
        break
      }
    }
    return index
  }

  @Watch('column.dataType')
  private watchDataType () {
    if (!this.stop) {
      const hints: Hint[] = []
      if (this.column.dataType.trim() === '') {
        this.typeHint.forEach((hint) => {
          hints.push({
            name: hint.name,
            html: hint.name,
            active: false
          })
        })
        this.hints = hints
      } else {
        this.typeHint.forEach((hint) => {
          if (hint.name.toLowerCase().indexOf(this.column.dataType.toLowerCase()) !== -1) {
            hints.push({
              name: hint.name,
              html: markToHTML('mark', hint.name, this.column.dataType),
              active: false
            })
          }
        })
        this.hints = hints
      }
    }
  }

  private activeEnd () {
    this.hints.forEach((hint) => hint.active = false)
  }

  // ==================== Event Handler ===================
  private onClick (hint: Hint) {
    log.debug('DataTypeHint onClick')
    this.stop = true
    this.store.eventBus.$emit(Bus.ColumnDataType.change, {
      columnId: this.column.id,
      value: hint.name
    })
    this.activeEnd()
  }

  private onMousedown (event: MouseEvent) {
    const el = event.target as HTMLElement
    if (!el.closest('.data-type')) {
      this.$emit('blur', event)
    }
  }

  private onSearch () {
    this.stop = false
  }

  private onArrowUp (event: KeyboardEvent) {
    event.preventDefault()
    const index = this.activeIndex
    if (index !== null && index !== 0) {
      this.hints[index].active = false
      this.hints[index - 1].active = true
    } else {
      if (index === 0) {
        this.hints[index].active = false
      }
      this.hints[this.hints.length - 1].active = true
    }
  }

  private onArrowDown (event: KeyboardEvent) {
    event.preventDefault()
    const index = this.activeIndex
    if (index !== null && index !== this.hints.length - 1) {
      this.hints[index].active = false
      this.hints[index + 1].active = true
    } else {
      if (index === this.hints.length - 1) {
        this.hints[index].active = false
      }
      this.hints[0].active = true
    }
  }

  private onArrowRight (event: KeyboardEvent) {
    const index = this.activeIndex
    if (index !== null) {
      event.preventDefault()
      this.stop = true
      this.store.eventBus.$emit(Bus.ColumnDataType.change, {
        columnId: this.column.id,
        value: this.hints[index].name
      })
    }
  }

  private onArrowLeft (event: KeyboardEvent) {
    this.activeEnd()
  }

  // ==================== Event Handler END ===================

  // ==================== Life Cycle ====================
  private created () {
    this.store.eventBus.$on(Bus.DataTypeHint.search, this.onSearch)
    this.store.eventBus.$on(Bus.DataTypeHint.arrowUp, this.onArrowUp)
    this.store.eventBus.$on(Bus.DataTypeHint.arrowDown, this.onArrowDown)
    this.store.eventBus.$on(Bus.DataTypeHint.arrowRight, this.onArrowRight)
    this.store.eventBus.$on(Bus.DataTypeHint.arrowLeft, this.onArrowLeft)
  }

  private mounted () {
    this.watchDataType()
    this.subMousedown = this.mousedown$.subscribe(this.onMousedown)
  }

  private destroyed () {
    this.subMousedown.unsubscribe()
    this.store.eventBus.$off(Bus.DataTypeHint.search, this.onSearch)
    this.store.eventBus.$off(Bus.DataTypeHint.arrowUp, this.onArrowUp)
    this.store.eventBus.$off(Bus.DataTypeHint.arrowDown, this.onArrowDown)
    this.store.eventBus.$off(Bus.DataTypeHint.arrowRight, this.onArrowRight)
    this.store.eventBus.$off(Bus.DataTypeHint.arrowLeft, this.onArrowLeft)
  }

  // ==================== Life Cycle END ====================
}
</script>

<style scoped lang="scss">
  .data-type-hint {
    position: absolute;
    left: 0;
    background-color: $color-table;
    opacity: 0.9;
    z-index: 100000000;

    li {
      padding: 5px;
      cursor: pointer;
      font-size: $size-font;
      color: $color-font;

      & /deep/ .mark {
        color: $color-mark;
      }

      &:hover {
        color: $color-font-active;
        background-color: $color-contextmenu-active;

        & /deep/ .mark {
          color: $color-font-active;
        }
      }

      &.active {
        color: $color-font-active;
        background-color: $color-contextmenu-active;

        & /deep/ .mark {
          color: $color-font-active;
        }
      }
    }
  }

  /* animation */
  .hint-move {
    transition: transform 0.3s;
  }

  .hint-enter-active {
    transition: all 0.3s ease;
  }

  .hint-enter {
    transform: translateY(-25px);
    opacity: 0;
  }

  ul, ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
