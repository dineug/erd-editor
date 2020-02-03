<template lang="pug">
  .workspace-sql
    code.erd-sql.hljs.scrollbar(
      contenteditable="true"
      spellcheck="false"
      v-html="value"
    )
</template>

<script lang="ts">
import SQLFactory from "@/ts/SQL";
import { Commit as CanvasCommit } from "@/store/canvas";
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { Subscription, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import hljs from "@/plugins/highlight";

@Component
export default class SQL extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;

  private value: string = "";
  private databaseName$: Subject<void> = new Subject();
  private subDatabaseName!: Subscription;

  @Watch("store.canvasStore.state.database")
  private watchDatabase() {
    this.convertSQL();
  }

  @Watch("store.canvasStore.state.databaseName")
  private watchDatabaseName() {
    this.databaseName$.next();
  }

  private convertSQL() {
    const sql = SQLFactory.toDDL(this.store);
    this.value = hljs.highlight("sql", sql).value;
  }

  private created() {
    this.convertSQL();
    this.subDatabaseName = this.databaseName$
      .pipe(debounceTime(300))
      .subscribe(() => {
        this.convertSQL();
      });
  }

  private mounted() {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0;
      this.$el.parentElement.scrollLeft = 0;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: 0,
        scrollLeft: 0
      });
    }
  }

  private destroyed() {
    this.subDatabaseName.unsubscribe();
  }
}
</script>

<style scoped lang="scss">
.workspace-sql {
  margin-top: $size-top-menu-height;
  height: calc(100% - 30px);
  white-space: pre;

  .erd-sql {
    height: 100%;
    padding: 5px;
    box-sizing: border-box;
    background-color: $color-sql;
  }
}
</style>
