import './SQLDDL';
import './GeneratorCode';
import './indexes/Indexes';

import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { useContext } from '@/core/hooks/context.hook';
import { getData } from '@/core/helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-table-properties-drawer': TablePropertiesDrawerElement;
  }
}

export interface TablePropertiesDrawerProps {
  width: number;
  visible: boolean;
  tableId: string;
}

export interface TablePropertiesDrawerElement
  extends TablePropertiesDrawerProps,
    HTMLElement {}

interface TablePropertiesDrawerState {
  tabType: TabType;
}

type TabType = 'indexes' | 'SQL' | 'GeneratorCode';

interface Tab {
  name: string;
  type: TabType;
}

const tabs: Tab[] = [
  {
    name: 'Indexes',
    type: 'indexes',
  },
  {
    name: 'SQL DDL',
    type: 'SQL',
  },
  {
    name: 'Generator Code',
    type: 'GeneratorCode',
  },
];

const TablePropertiesDrawer: FunctionalComponent<
  TablePropertiesDrawerProps,
  TablePropertiesDrawerElement
> = (props, ctx) => {
  const state = observable<TablePropertiesDrawerState>({
    tabType: 'indexes',
  });
  const contextRef = useContext(ctx);

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  const onChangeTab = (tabType: TabType) => (state.tabType = tabType);

  return () => {
    const { tables } = contextRef.value.store.tableState;
    const table = getData(tables, props.tableId);

    return html`
      <vuerd-drawer
        .name=${`Table Properties "${table?.name ?? ''}"`}
        .width=${props.width}
        .visible=${props.visible}
        @close=${onClose}
      >
        <div class="vuerd-table-properties">
          <ul class="vuerd-table-properties-tab">
            ${tabs.map(
              tab =>
                html`
                  <li
                    class=${classMap({
                      active: tab.type === state.tabType,
                    })}
                    @click=${() => onChangeTab(tab.type)}
                  >
                    ${tab.name}
                  </li>
                `
            )}
          </ul>
          <div class="vuerd-table-properties-body">
            ${table
              ? state.tabType === 'indexes'
                ? html`<vuerd-indexes .table=${table}></vuerd-indexes>`
                : state.tabType === 'SQL'
                ? html`<vuerd-sql-ddl
                    mode="table"
                    .table=${table}
                  ></vuerd-sql-ddl>`
                : state.tabType === 'GeneratorCode'
                ? html`
                    <vuerd-generator-code
                      mode="table"
                      .table=${table}
                    ></vuerd-generator-code>
                  `
                : null
              : null}
          </div>
        </div>
      </vuerd-drawer>
    `;
  };
};

defineComponent('vuerd-table-properties-drawer', {
  observedProps: ['width', 'visible', 'tableId'],
  shadow: false,
  render: TablePropertiesDrawer,
});
