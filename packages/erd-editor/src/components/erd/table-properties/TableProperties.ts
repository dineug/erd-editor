import { FC, html, observable, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import TablePropertiesIndexes from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes';
import TablePropertiesTabs, {
  Tab,
} from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs';
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { query } from '@/utils/collection/query';
import { onStop } from '@/utils/domEvent';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './TableProperties.styles';

export type TablePropertiesProps = {
  isDarkMode: boolean;
  tableId: string;
  tableIds: string[];
  onChange: (tableId: string) => void;
};

const TableProperties: FC<TablePropertiesProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    tab: Tab.Indexes as Tab,
  });

  const handleClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.tableProperties]: false }));
  };

  const handleOutsideClick = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canClose = !el.closest('.table-properties');
    canClose && handleClose();
  };

  const handleChangeTab = (tab: Tab) => {
    state.tab = tab;
  };

  onMounted(() => {
    const { shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleClose();
      })
    );
  });

  return () => {
    const { store } = app.value;
    const { collections } = store.state;
    const { tableIds } = props;

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);

    return html`
      <div
        class=${styles.root}
        @contextmenu=${onStop}
        @mousedown=${onStop}
        @touchstart=${onStop}
        @wheel=${onStop}
        @click=${handleOutsideClick}
      >
        <div class=${['table-properties', styles.container]}>
          <div class=${['scrollbar', styles.header]}>
            ${tables.map(
              table => html`
                <div
                  class=${[
                    styles.tab,
                    { selected: table.id === props.tableId },
                  ]}
                  title=${table.name}
                  @click=${() => props.onChange(table.id)}
                >
                  <span>${table.name.trim() ? table.name : 'unnamed'}</span>
                </div>
              `
            )}
          </div>
          <${TablePropertiesTabs}
            value=${state.tab}
            .onChange=${handleChangeTab}
          />
          <div class=${['scrollbar', styles.scrollbarArea]}>
            ${state.tab === Tab.Indexes
              ? html`
                  <div class=${styles.scope}>
                    <${TablePropertiesIndexes} tableId=${props.tableId} />
                  </div>
                `
              : state.tab === Tab.SchemaSQL
                ? html`
                    <div class=${styles.scope}>
                      <${SchemaSQL}
                        isDarkMode=${props.isDarkMode}
                        tableId=${props.tableId}
                      />
                    </div>
                  `
                : state.tab === Tab.GeneratorCode
                  ? html`
                      <div class=${styles.scope}>
                        <${GeneratorCode}
                          isDarkMode=${props.isDarkMode}
                          tableId=${props.tableId}
                        />
                      </div>
                    `
                  : null}
          </div>
        </div>
      </div>
    `;
  };
};

export default TableProperties;
