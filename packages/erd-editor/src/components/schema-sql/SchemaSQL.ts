import { delay } from '@dineug/go';
import { FC, html, observable, onBeforeMount, watch } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Toast from '@/components/primitives/toast/Toast';
import SchemaSQLContextMenu from '@/components/schema-sql/schema-sql-context-menu/SchemaSQLContextMenu';
import { useUnmounted } from '@/hooks/useUnmounted';
import { copyToClipboard } from '@/utils/clipboard';
import { query } from '@/utils/collection/query';
import { openToastAction } from '@/utils/emitter';
import { createSchemaSQL, createSchemaSQLTable } from '@/utils/schema-sql';

import * as styles from './SchemaSQL.styles';

const hasPropName = arrayHas<string | number | symbol>([
  'database',
  'bracketType',
]);

export type SchemaSQLProps = {
  isDarkMode: boolean;
  tableId?: string;
};

const SchemaSQL: FC<SchemaSQLProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const contextMenu = useContextMenuRootProvider(ctx);

  const state = observable({
    sql: '',
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
      state.sql = createSchemaSQL(store.state);
    }
  };

  const handleCopy = () => {
    const { emitter } = app.value;

    copyToClipboard(state.sql).then(() => {
      emitter.emit(
        openToastAction({
          close: delay(2000),
          message: html`<${Toast} title="Copied!" />`,
        })
      );
    });
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  onBeforeMount(() => {
    const { store } = app.value;
    const { settings } = store.state;

    setSQL();

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        hasPropName(propName) && setSQL();
      }),
      watch(props).subscribe(propName => {
        propName === 'tableId' && setSQL();
      })
    );
  });

  return () => html`
    <div
      class=${styles.root}
      @contextmenu=${contextMenu.onContextmenu}
      @mousedown=${contextMenu.onMousedown}
    >
      <${CodeBlock}
        lang="sql"
        theme=${props.isDarkMode ? 'dark' : 'light'}
        value=${state.sql}
        .onCopy=${handleCopy}
      />
      ${contextMenu.state.show
        ? html`<${SchemaSQLContextMenu} .onClose=${handleContextmenuClose} />`
        : null}
    </div>
  `;
};

export default SchemaSQL;
