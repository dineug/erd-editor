import { FC, html, Ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import Kbd from '@/components/primitives/kbd/Kbd';
import { startAutomaticTablePlacementAction } from '@/engine/modules/editor/atom.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { changeColumnPrimaryKeyAction$ } from '@/engine/modules/tableColumn/generator.actions';
import { ValuesType } from '@/internal-types';
import { query } from '@/utils/collection/query';
import { openColorPickerAction } from '@/utils/emitter';

import { createDatabaseMenus } from './menus/databaseMenus';
import { createDrawRelationshipMenus } from './menus/drawRelationshipMenus';
import { createExportMenus } from './menus/exportMenus';
import { createImportMenus } from './menus/importMenus';
import { createRelationshipMenus } from './menus/relationshipMenus';
import { createShowMenus } from './menus/showMenus';

export const ErdContextMenuType = {
  ERD: 'ERD',
  table: 'table',
  relationship: 'relationship',
} as const;
export type ErdContextMenuType = ValuesType<typeof ErdContextMenuType>;

export type ErdContextMenuProps = {
  type: ErdContextMenuType;
  canvas: Ref<HTMLDivElement>;
  relationshipId?: string;
  tableId?: string;
  onClose: () => void;
};

const ErdContextMenu: FC<ErdContextMenuProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleAddTable = () => {
    const { store } = app.value;
    store.dispatch(addTableAction$());
    props.onClose();
  };

  const handleAddMemo = () => {
    const { store } = app.value;
    store.dispatch(addMemoAction$());
    props.onClose();
  };

  const handleAutomaticTablePlacement = () => {
    const { store } = app.value;
    store.dispatch(startAutomaticTablePlacementAction());
    props.onClose();
  };

  const handleRemoveRelationship = () => {
    if (!props.relationshipId) return;
    const { store } = app.value;
    store.dispatch(
      removeRelationshipAction({
        id: props.relationshipId,
      })
    );
  };

  const handleChangeColumnPrimaryKey = () => {
    if (!props.tableId) return;
    const { store } = app.value;
    const { editor } = store.state;
    if (!editor.focusTable || !editor.focusTable.columnId) return;

    store.dispatch(
      changeColumnPrimaryKeyAction$(
        editor.focusTable.tableId,
        editor.focusTable.columnId
      )
    );
    props.onClose();
  };

  const handleOpenTableProperties = () => {
    if (!props.tableId) return;
    // TODO: handleOpenTableProperties
    console.log('handleOpenTableProperties');
    props.onClose();
  };

  const handleOpenColorPicker = (event: MouseEvent) => {
    if (!props.tableId) return;

    const { store, emitter } = app.value;
    const { collections } = store.state;
    const table = query(collections)
      .collection('tableEntities')
      .selectById(props.tableId);
    if (!table) return;

    emitter.emit(
      openColorPickerAction({
        x: event.clientX,
        y: event.clientY,
        color: table.ui.color,
      })
    );
    props.onClose();
  };

  const chevronRightIcon = html`<${Icon} name="chevron-right" size=${14} />`;

  return () => {
    const { keyBindingMap } = app.value;

    return html`
      <${ContextMenu.Root}
        children=${props.type === ErdContextMenuType.table
          ? html`
              <${ContextMenu.Item}
                .onClick=${handleChangeColumnPrimaryKey}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="key" size=${14} />`}
                    name="Primary Key"
                  />
                `}
              />
              <${ContextMenu.Item}
                .onClick=${handleOpenTableProperties}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`
                      <${Icon} prefix="mdi" name="table-cog" size=${14} />
                    `}
                    name="Table Properties"
                  />
                `}
              />
              <${ContextMenu.Item}
                .onClick=${handleOpenColorPicker}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="palette" size=${14} />`}
                    name="Color"
                  />
                `}
              />
            `
          : props.type === ErdContextMenuType.relationship
          ? html`
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`
                      <${Icon} prefix="mdi" name="vector-line" size=${14} />
                    `}
                    name="Relationship Type"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createRelationshipMenus(
                  app.value,
                  props.relationshipId
                ).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${menu.checked
                            ? html`<${Icon} name="check" size=${14} />`
                            : null}
                          name=${html`
                            <${ContextMenu.Menu}
                              icon=${html` <${Icon}
                                prefix="base64"
                                name=${menu.iconName}
                                size=${14}
                              />`}
                              name=${menu.name}
                            />
                          `}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                .onClick=${handleRemoveRelationship}
                children=${html`<${ContextMenu.Menu} name="Delete" />`}
              />
            `
          : html`
              <${ContextMenu.Item}
                .onClick=${handleAddTable}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="table" size=${14} />`}
                    name="New Table"
                    right=${html`
                      <${Kbd} shortcut=${keyBindingMap.addTable[0]?.shortcut} />
                    `}
                  />
                `}
              />
              <${ContextMenu.Item}
                .onClick=${handleAddMemo}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="note-sticky" size=${14} />`}
                    name="New Memo"
                    right=${html`
                      <${Kbd} shortcut=${keyBindingMap.addMemo[0]?.shortcut} />
                    `}
                  />
                `}
              />
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`
                      <${Icon} prefix="mdi" name="vector-line" size=${14} />
                    `}
                    name="Relationship"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createDrawRelationshipMenus(
                  app.value,
                  props.onClose
                ).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${html`
                            <${Icon}
                              prefix="base64"
                              name=${menu.iconName}
                              size=${14}
                            />
                          `}
                          name=${menu.name}
                          right=${html` <${Kbd} shortcut=${menu.shortcut} /> `}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="eye" size=${14} />`}
                    name="View Option"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createShowMenus(app.value).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${menu.checked
                            ? html`<${Icon} name="check" size=${14} />`
                            : null}
                          name=${menu.name}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`
                      <${Icon} prefix="mdi" name="database" size=${14} />
                    `}
                    name="Database"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createDatabaseMenus(app.value).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${menu.checked
                            ? html`<${Icon} name="check" size=${14} />`
                            : null}
                          name=${menu.name}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="file-import" size=${14} />`}
                    name="Import"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createImportMenus(
                  app.value,
                  props.onClose
                ).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${html`<${Icon}
                            prefix=${menu.icon.prefix}
                            name=${menu.icon.name}
                            size=${14}
                          />`}
                          name=${menu.name}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon} name="file-export" size=${14} />`}
                    name="Export"
                    right=${chevronRightIcon}
                  />
                `}
                subChildren=${html`${createExportMenus(
                  app.value,
                  props.onClose,
                  props.canvas.value
                ).map(
                  menu => html`
                    <${ContextMenu.Item}
                      .onClick=${menu.onClick}
                      children=${html`
                        <${ContextMenu.Menu}
                          icon=${html`<${Icon}
                            prefix=${menu.icon.prefix}
                            name=${menu.icon.name}
                            size=${14}
                          />`}
                          name=${menu.name}
                        />
                      `}
                    />
                  `
                )}`}
              />
              <${ContextMenu.Item}
                .onClick=${handleAutomaticTablePlacement}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${html`<${Icon}
                      prefix="mdi"
                      name="atom"
                      size=${14}
                    />`}
                    name="Automatic Table Placement"
                  />
                `}
              />
            `}
      />
    `;
  };
};

export default ErdContextMenu;
