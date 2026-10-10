import { query } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  nextTick,
  observable,
  onBeforeMount,
  ref,
  watch,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import { localized } from '@/components/localized/Localized';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Icon from '@/components/primitives/icon/Icon';
import Toast from '@/components/primitives/toast/Toast';
import SchemaSQLContextMenu from '@/components/schema-sql/schema-sql-context-menu/SchemaSQLContextMenu';
import SchemaSQLOptions, {
  keepSpace,
} from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions';
import * as optionsStyles from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions.styles';
import {
  resolvePanel,
  type SchemaSQLView,
  schemaSQLViewOf,
} from '@/components/schema-sql/schemaSQLView';
import { Database } from '@/constants/schema';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { copyToClipboard } from '@/utils/clipboard';
import { openToastAction } from '@/utils/emitter';
import { exportSchemaSQL } from '@/utils/file/exportFile';
import { delay } from '@/utils/promise';
import {
  createSchemaSQL,
  createSchemaSQLTable,
  oracleLongNames,
  schemaSQLTables,
} from '@/utils/schema-sql';

import * as styles from './SchemaSQL.styles';

/** The settings the text is written from; no other one changes a byte of it. */
const hasPropName = arrayHas<string | number | symbol>([
  'database',
  'bracketType',
  'databaseName',
  'ddlScripts',
]);

/** This window's choices that change the text, as opposed to the panel's place. */
const hasViewPropName = arrayHas<string | number | symbol>([
  'statements',
  'header',
]);

export type SchemaSQLProps = {
  isDarkMode: boolean;
  /** One table's DDL, as Table Properties shows it: always created, no options. */
  tableId?: string;
  readonly?: boolean;
};

const SchemaSQL: FC<SchemaSQLProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const showButton = createRef<HTMLButtonElement>();

  const state = observable({
    sql: '',
    tables: [] as string[],
    longNames: [] as string[],
  });

  const setSQL = () => {
    const { store } = app.value;

    if (props.tableId) {
      const { collections } = store.state;
      const table = query(collections)
        .collection('tableEntities')
        .selectById(props.tableId);

      if (table) {
        state.sql = createSchemaSQLTable(store.state, table);
      }
    } else {
      const { statements, header } = schemaSQLViewOf(app.value);

      state.sql = createSchemaSQL(store.state, undefined, undefined, {
        statements,
        header,
      });
      state.tables = schemaSQLTables(store.state);
      state.longNames =
        store.state.settings.database === Database.Oracle
          ? oracleLongNames(store.state)
          : [];
    }
  };

  const handleCopy = () => {
    const { emitter } = app.value;

    copyToClipboard(state.sql).then(() => {
      emitter.emit(
        openToastAction({
          close: delay(2000),
          message: <Toast title={localized('common.toast.copied')} />,
        })
      );
    });
  };

  const handleSave = () => {
    const { store } = app.value;
    exportSchemaSQL(state.sql, store.state.settings.databaseName);
  };

  const handleHide = () => {
    schemaSQLViewOf(app.value).panel = 'closed';
    // The button is the code block's tools, which it renders a tick after this
    // component hands them over.
    nextTick(() => nextTick(() => showButton.value?.focus()));
  };

  const handleShow = () => {
    schemaSQLViewOf(app.value).panel = 'open';
    nextTick(() => {
      root.value
        ?.querySelector<HTMLButtonElement>('.schema-sql-options-hide')
        ?.focus();
    });
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  // The width is read only while the panel is unset, so a decided panel
  // never renders again for a resize.
  const shownPanel = (view: SchemaSQLView) =>
    view.panel === 'unset'
      ? resolvePanel(view, app.value.store.state.editor.viewport.width)
      : view.panel;

  onBeforeMount(() => {
    const { store } = app.value;
    const { settings } = store.state;

    setSQL();

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        hasPropName(propName) && setSQL();
      }),
      watch(schemaSQLViewOf(app.value)).subscribe(propName => {
        !props.tableId && hasViewPropName(propName) && setSQL();
      }),
      watch(props).subscribe(propName => {
        propName === 'tableId' && setSQL();
      })
    );
  });

  return () => {
    const { t, dir } = i18n.value;
    const full = !props.tableId;
    const view = schemaSQLViewOf(app.value);
    const panel = full ? shownPanel(view) : 'unknown';

    // The code stays left of the panel in every language; the panel and the
    // menu read in the reader's direction.
    return (
      <>
        <div
          use:ref={ref(root)}
          class={styles.root}
          prop:dir="ltr"
          on:mousedown={contextMenu.onMousedown}
        >
          <div class={styles.code} on:contextmenu={contextMenu.onContextmenu}>
            <CodeBlock
              lang="sql"
              theme={props.isDarkMode ? 'dark' : 'light'}
              value={state.sql}
              onCopy={handleCopy}
              tools={
                panel === 'closed' ? (
                  <button
                    use:ref={ref(showButton)}
                    type="button"
                    class={[
                      'schema-sql-options-show',
                      optionsStyles.icon,
                      styles.show,
                    ]}
                    aria-label={t('code.showOptions')}
                    title={t('code.showOptions')}
                    aria-expanded="false"
                    on:click={handleShow}
                    on:keydown={keepSpace}
                  >
                    <Icon name="panel-right-open" size={16} />
                  </button>
                ) : null
              }
            />
          </div>
          {panel === 'open' ? (
            <SchemaSQLOptions
              isDarkMode={props.isDarkMode}
              readonly={Boolean(props.readonly)}
              tables={state.tables}
              longNames={state.longNames}
              onHide={handleHide}
              onSave={handleSave}
              onCopy={handleCopy}
            />
          ) : null}
        </div>
        {contextMenu.state.show ? (
          <div prop:dir={dir}>
            <SchemaSQLContextMenu
              full={full}
              onSave={handleSave}
              onClose={handleContextmenuClose}
            />
          </div>
        ) : null}
      </>
    );
  };
};

export default SchemaSQL;
