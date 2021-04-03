import { ERDEditorElement } from '@@types/components/ERDEditorElement';
import { PanelConfig } from '@@types/core/panel';
import { Theme } from '@@types/core/theme';
import { Keymap } from '@@types/core/keymap';
import { ExtensionConfig } from '@@types/core/extension';
import { Database } from '@@types/engine/store/canvas.state';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { beforeMount } from '@dineug/lit-observable';
import { DDLParser } from '@dineug/sql-ddl-parser';
import {
  clear,
  loadJson$,
  initLoadJson$,
} from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { createJson } from '@/core/parser/SQLParserToJson';
import { databaseList } from '@/engine/store/canvas.state';
import { loadTheme } from '@/core/theme';
import { loadKeymap } from '@/core/keymap';
import { createDDL } from '@/core/sql/ddl';
import { createJsonStringify } from '@/core/file';
import { isArray, isString } from '@/core/helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';

export function useERDEditorElement(
  context: IERDEditorContext,
  ctx: ERDEditorElement,
  { setFocus }: { setFocus: () => void }
) {
  const { store, helper } = context;
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
      const json = createJson(statements, helper, store.canvasState.database);
      store.dispatch(loadJson$(json), sortTable());
    }
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
  };

  beforeMount(() =>
    unmountedGroup.push(
      store.change$.subscribe(() =>
        ctx.dispatchEvent(new CustomEvent('change'))
      )
    )
  );
}
