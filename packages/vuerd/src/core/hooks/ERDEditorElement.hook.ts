import { beforeMount } from '@vuerd/lit-observable';
import { DDLParser } from '@vuerd/sql-ddl-parser';

import { createJsonStringify, loadLiquibaseChangelog } from '@/core/file';
import { isArray, isString } from '@/core/helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { loadKeymap } from '@/core/keymap';
import { createJson } from '@/core/parser/ParserToJson';
import { createDDL } from '@/core/sql/ddl';
import { loadTheme } from '@/core/theme';
import {
  clear,
  initLoadJson$,
  loadJson$,
} from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { databaseList } from '@/engine/store/canvas.state';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { ERDEditorElement } from '@@types/components/ERDEditorElement';
import { ExtensionConfig } from '@@types/core/extension';
import { Keymap } from '@@types/core/keymap';
import { LoadLiquibaseData } from '@@types/core/liquibaseParser';
import { PanelConfig } from '@@types/core/panel';
import { Theme } from '@@types/core/theme';
import { Database } from '@@types/engine/store/canvas.state';

export function useERDEditorElement(
  context: IERDEditorContext,
  ctx: ERDEditorElement,
  {
    setFocus,
  }: {
    setFocus: () => void;
  }
) {
  const { store, helper, eventBus } = context;
  const { editorState } = store;
  const { unmountedGroup } = useUnmounted();

  Object.defineProperty(ctx, 'value', {
    get() {
      const { store } = context;
      return createJsonStringify(store);
    },
    set(json: string) {
      const { store } = context;
      isString(json) && json.trim()
        ? store.dispatch(loadJson$(json))
        : store.dispatch(clear());
    },
  });

  ctx.focus = () => {
    helper.focus();
    setFocus();
  };

  ctx.blur = () => {
    helper.blur();
    setFocus();
  };

  ctx.clear = () => {
    store.dispatch(clear());
  };

  ctx.initLoadJson = (json: string) => {
    if (isString(json) && json.trim()) {
      store.dispatch(initLoadJson$(json));
    }
  };

  ctx.loadSQLDDL = (sql: string) => {
    if (isString(sql) && sql.trim()) {
      const statements = DDLParser(sql);
      // @ts-ignore
      const json = createJson(statements, helper, store.canvasState.database);
      store.dispatch(loadJson$(json), sortTable());
    }
  };

  ctx.loadLiquibase = (data: LoadLiquibaseData) => {
    loadLiquibaseChangelog(context, data, 'postgresql');
  };

  ctx.getSQLDDL = (database?: Database) => {
    return database && databaseList.includes(database)
      ? createDDL(store, database)
      : createDDL(store);
  };

  ctx.setTheme = (theme: Partial<Theme>) => loadTheme(context.theme, theme);

  ctx.setKeymap = (keymap: Partial<Keymap>) =>
    loadKeymap(context.keymap, keymap);

  ctx.extension = (config: Partial<ExtensionConfig>) => {
    isArray(config.panels) &&
      editorState.panels.push(...(config.panels as PanelConfig[]));
    isArray(config.excludePanel) &&
      (editorState.excludePanel = config.excludePanel as RegExp[]);
  };

  eventBus.on(Bus.Liquibase.progress).subscribe(message =>
    ctx.dispatchEvent(
      new CustomEvent('liquibase-progress', {
        detail: message,
      })
    )
  );

  eventBus
    .on(Bus.Liquibase.progressEnd)
    .subscribe(() =>
      ctx.dispatchEvent(new CustomEvent('liquibase-progress-end'))
    );

  const emitChange = () =>
    editorState.readonly || ctx.dispatchEvent(new CustomEvent('change'));

  beforeMount(() =>
    unmountedGroup.push(
      store.change$.subscribe(emitChange),
      eventBus.on(Bus.Editor.change).subscribe(emitChange)
    )
  );
}
