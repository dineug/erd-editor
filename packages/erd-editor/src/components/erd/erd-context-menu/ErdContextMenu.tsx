import { query } from '@dineug/erd-editor-schema';
import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import Kbd from '@/components/primitives/kbd/Kbd';
import { Open } from '@/constants/open';
import { GeneratorAction } from '@/engine/generator.actions';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import {
  removeColorAllAction$,
  removeSelectedAction$,
} from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { hasColoredSelection } from '@/engine/modules/editor/utils/color';
import {
  getFocusedColumnIds,
  getRemovableColumns,
} from '@/engine/modules/editor/utils/focus';
import {
  focusCentersOf,
  focusFlowTableAction$,
} from '@/engine/modules/editor/view.generator.actions';
import {
  addMemoAction$,
  removeMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction$,
  removeTableAction$,
} from '@/engine/modules/table/generator.actions';
import {
  changeColumnsPrimaryKeyAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import type { PlainMessageKey } from '@/i18n/translate';
import { ValuesType } from '@/internal-types';
import {
  openColorPickerAction,
  openFindReplaceAction,
  openTablePropertiesAction,
} from '@/utils/emitter';
import { importDiffJSON } from '@/utils/file/importFile';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { createDatabaseMenus } from './menus/databaseMenus';
import { createDrawRelationshipMenus } from './menus/drawRelationshipMenus';
import { createExportMenus } from './menus/exportMenus';
import { createImportMenus } from './menus/importMenus';
import {
  createReferentialActionMenus,
  createRelationshipMenus,
  ReferentialActionField,
} from './menus/relationshipMenus';
import { createShowMenus } from './menus/showMenus';
import { createTablePlacementMenus } from './menus/tablePlacementMenus';

export const ErdContextMenuType = {
  ERD: 'ERD',
  table: 'table',
  memo: 'memo',
  relationship: 'relationship',
} as const;
export type ErdContextMenuType = ValuesType<typeof ErdContextMenuType>;

const referentialActionItems: Array<{
  field: ReferentialActionField;
  labelKey: PlainMessageKey;
}> = [
  { field: 'onDelete', labelKey: 'contextMenu.onDelete' },
  { field: 'onUpdate', labelKey: 'contextMenu.onUpdate' },
];

export type ErdContextMenuProps = {
  type: ErdContextMenuType;
  relationshipId?: string;
  tableId?: string;
  /** The column whose row the press that raised a table menu landed on. */
  columnId?: string;
  memoId?: string;
  onClose: () => void;
};

/** What a menu's Delete reads and what it dispatches when picked. */
type Removal = {
  labelKey: PlainMessageKey;
  action: () => GeneratorAction;
};

/** Every selected table and memo, which Delete reaches inside a multi-selection. */
const selectionRemoval: Removal = {
  labelKey: 'contextMenu.deleteSelected',
  action: removeSelectedAction$,
};

/** Whether the table or memo a menu was raised over is one of two or more selected. */
const isOneOfSelection = (
  selectedMap: Record<string, SelectType>,
  id: string
) => Boolean(selectedMap[id]) && Object.keys(selectedMap).length > 1;

const ErdContextMenu: FC<ErdContextMenuProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const chevronRightIcon = <Icon name="chevron-right" size={14} />;
  const { addUnsubscribe } = useUnmounted();

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

  const handleOpenFindReplace = () => {
    const { emitter } = app.value;
    emitter.emit(openFindReplaceAction());
    props.onClose();
  };

  const handleOpenDiffViewer = () => {
    importDiffJSON(app.value);
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
    props.onClose();
  };

  /** The focused column's key, or that of the whole selection it belongs to. */
  const handleChangeColumnPrimaryKey = () => {
    if (!props.tableId) return;
    const { store } = app.value;
    const { focusTable } = store.state.editor;
    if (!focusTable?.columnId) return;

    store.dispatch(
      changeColumnsPrimaryKeyAction$(
        focusTable.tableId,
        getFocusedColumnIds(store.state)
      )
    );
    props.onClose();
  };

  const handleOpenTableProperties = () => {
    if (!props.tableId) return;

    const { store, emitter } = app.value;
    emitter.emit(openTablePropertiesAction({ tableId: props.tableId }));
    store.dispatch(changeOpenMapAction({ [Open.tableProperties]: true }));
    props.onClose();
  };

  /** The Flow view on the table the menu was raised over, or on the whole selection it belongs to. */
  const handleFocusFlowTable = () => {
    if (!props.tableId) return;

    const { store } = app.value;
    const { selectedMap } = store.state.editor;
    store.dispatch(
      focusFlowTableAction$(focusCentersOf(selectedMap, props.tableId))
    );
    props.onClose();
  };

  const openColorPicker = (event: MouseEvent, color: string) => {
    const { emitter } = app.value;
    emitter.emit(
      openColorPickerAction({ x: event.clientX, y: event.clientY, color })
    );
    props.onClose();
  };

  const handleOpenColorPicker = (event: MouseEvent) => {
    if (!props.tableId) return;

    const { store } = app.value;
    const table = query(store.state.collections)
      .collection('tableEntities')
      .selectById(props.tableId);
    if (!table) return;

    openColorPicker(event, table.ui.color);
  };

  /** The colors of the selection the menu was raised over, as the picker's No color clears them. */
  const handleRemoveColor = () => {
    const { store } = app.value;
    store.dispatch(removeColorAllAction$());
    props.onClose();
  };

  const handleOpenMemoColorPicker = (event: MouseEvent) => {
    if (!props.memoId) return;

    const { store } = app.value;
    const memo = query(store.state.collections)
      .collection('memoEntities')
      .selectById(props.memoId);
    if (!memo) return;

    openColorPicker(event, memo.ui.color);
  };

  /**
   * What Delete reaches from the table the menu was raised over: the selected
   * columns the key would remove when raised over one of them, else the
   * selection the table is one of, or the table alone.
   */
  const getTableRemoval = (tableId: string): Removal => {
    const { state } = app.value.store;
    const columns = getRemovableColumns(state);

    if (
      columns?.tableId === tableId &&
      props.columnId &&
      columns.columnIds.includes(props.columnId)
    ) {
      // Two words chosen by whether there are several, since the row shows no
      // number for a plural rule to pick a form by.
      return {
        labelKey:
          columns.columnIds.length > 1
            ? 'contextMenu.deleteColumns'
            : 'contextMenu.deleteColumn',
        action: () => removeColumnAction$(tableId, columns.columnIds),
      };
    }

    return isOneOfSelection(state.editor.selectedMap, tableId)
      ? selectionRemoval
      : {
          labelKey: 'contextMenu.delete',
          action: () => removeTableAction$(tableId),
        };
  };

  const handleRemoveTable = () => {
    if (!props.tableId) return;

    const { store } = app.value;
    store.dispatch(getTableRemoval(props.tableId).action());
    props.onClose();
  };

  /**
   * What Delete reaches from the memo the menu was raised over: the selection
   * the memo is one of, or the memo alone.
   */
  const getMemoRemoval = (memoId: string): Removal =>
    isOneOfSelection(app.value.store.state.editor.selectedMap, memoId)
      ? selectionRemoval
      : {
          labelKey: 'contextMenu.delete',
          action: () => removeMemoAction$(memoId),
        };

  const handleRemoveMemo = () => {
    if (!props.memoId) return;

    const { store } = app.value;
    store.dispatch(getMemoRemoval(props.memoId).action());
    props.onClose();
  };

  onMounted(() => {
    const { shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        // The key a Delete row names takes away what the menu was raised over.
        if (
          type === KeyBindingName.stop ||
          type === KeyBindingName.removeSelection
        ) {
          props.onClose();
        }
      })
    );
  });

  return () => {
    const { keyBindingMap, store } = app.value;
    const { t } = i18n.value;
    const focusesGroup =
      Boolean(props.tableId) &&
      focusCentersOf(store.state.editor.selectedMap, props.tableId).length > 1;
    const keysSelection = getFocusedColumnIds(store.state).length > 1;
    const removeShortcut = keyBindingMap.removeSelection[0]?.shortcut;
    const removeColorItem = hasColoredSelection(store.state) ? (
      <ContextMenu.Item
        onClick={handleRemoveColor}
        children={<ContextMenu.Menu name={t('contextMenu.removeColor')} />}
      />
    ) : null;

    return (
      <ContextMenu.Root
        children={
          props.type === ErdContextMenuType.table ? (
            <>
              <ContextMenu.Item
                onClick={handleChangeColumnPrimaryKey}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="key-round" size={14} />}
                    name={
                      keysSelection
                        ? t('contextMenu.primaryKeyOnSelectedColumns')
                        : t('common.primaryKey')
                    }
                    right={
                      <Kbd shortcut={keyBindingMap.primaryKey[0]?.shortcut} />
                    }
                  />
                }
              />
              <ContextMenu.Item
                onClick={handleOpenTableProperties}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="table-properties" size={14} />}
                    name={t('common.tableProperties')}
                    right={
                      <Kbd
                        shortcut={keyBindingMap.tableProperties[0]?.shortcut}
                      />
                    }
                  />
                }
              />
              <ContextMenu.Item
                onClick={handleFocusFlowTable}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="waypoints" size={14} />}
                    name={
                      focusesGroup
                        ? t('contextMenu.focusOnSelectedTables')
                        : t('contextMenu.focusOnThisTable')
                    }
                    right={
                      <Kbd shortcut={keyBindingMap.focusView[0]?.shortcut} />
                    }
                  />
                }
              />
              <ContextMenu.Item
                onClick={handleOpenColorPicker}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="palette" size={14} />}
                    name={t('common.color')}
                  />
                }
              />
              {removeColorItem}
              <ContextMenu.Item
                onClick={handleRemoveTable}
                children={
                  <ContextMenu.Menu
                    name={t(
                      props.tableId
                        ? getTableRemoval(props.tableId).labelKey
                        : 'contextMenu.delete'
                    )}
                    right={<Kbd shortcut={removeShortcut} />}
                  />
                }
              />
            </>
          ) : props.type === ErdContextMenuType.memo ? (
            <>
              <ContextMenu.Item
                onClick={handleOpenMemoColorPicker}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="palette" size={14} />}
                    name={t('common.color')}
                  />
                }
              />
              {removeColorItem}
              <ContextMenu.Item
                onClick={handleRemoveMemo}
                children={
                  <ContextMenu.Menu
                    name={t(
                      props.memoId
                        ? getMemoRemoval(props.memoId).labelKey
                        : 'contextMenu.delete'
                    )}
                    right={<Kbd shortcut={removeShortcut} />}
                  />
                }
              />
            </>
          ) : props.type === ErdContextMenuType.relationship ? (
            <>
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="spline" size={14} />}
                    name={t('contextMenu.relationshipType')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createRelationshipMenus(
                      app.value,
                      props.relationshipId,
                      i18n.value
                    ).map(menu => (
                      <ContextMenu.Item
                        onClick={menu.onClick}
                        children={
                          <ContextMenu.Menu
                            icon={
                              menu.checked ? (
                                <Icon name="check" size={14} />
                              ) : null
                            }
                            name={
                              <ContextMenu.Menu
                                icon={<Icon name={menu.iconName} size={14} />}
                                name={menu.name}
                              />
                            }
                          />
                        }
                      />
                    ))}
                  </>
                }
              />
              {referentialActionItems.map(({ field, labelKey }) => (
                <ContextMenu.Item
                  children={
                    <ContextMenu.Menu
                      name={t(labelKey)}
                      right={chevronRightIcon}
                    />
                  }
                  subChildren={
                    <>
                      {createReferentialActionMenus(
                        app.value,
                        field,
                        props.relationshipId,
                        i18n.value
                      ).map(menu => (
                        <ContextMenu.Item
                          onClick={menu.onClick}
                          children={
                            <ContextMenu.Menu
                              icon={
                                menu.checked ? (
                                  <Icon name="check" size={14} />
                                ) : null
                              }
                              name={menu.name}
                              right={
                                menu.note ? (
                                  <span style={{ color: 'var(--placeholder)' }}>
                                    {menu.note}
                                  </span>
                                ) : null
                              }
                            />
                          }
                        />
                      ))}
                    </>
                  }
                />
              ))}
              <ContextMenu.Item
                onClick={handleRemoveRelationship}
                children={<ContextMenu.Menu name={t('contextMenu.delete')} />}
              />
            </>
          ) : (
            <>
              <ContextMenu.Item
                onClick={handleAddTable}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="table-2" size={14} />}
                    name={t('common.newTable')}
                    right={
                      <Kbd shortcut={keyBindingMap.addTable[0]?.shortcut} />
                    }
                  />
                }
              />
              <ContextMenu.Item
                onClick={handleAddMemo}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="sticky-note" size={14} />}
                    name={t('common.newMemo')}
                    right={
                      <Kbd shortcut={keyBindingMap.addMemo[0]?.shortcut} />
                    }
                  />
                }
              />
              <ContextMenu.Item
                onClick={handleOpenFindReplace}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="text-search" size={14} />}
                    name={t('common.findAndReplace')}
                    right={
                      <Kbd shortcut={keyBindingMap.findReplace[0]?.shortcut} />
                    }
                  />
                }
              />
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="spline" size={14} />}
                    name={t('common.relationship')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createDrawRelationshipMenus(app.value, props.onClose).map(
                      menu => (
                        <ContextMenu.Item
                          onClick={menu.onClick}
                          children={
                            <ContextMenu.Menu
                              icon={<Icon name={menu.iconName} size={14} />}
                              name={menuLabel(i18n.value, menu)}
                              right={<Kbd shortcut={menu.shortcut} />}
                            />
                          }
                        />
                      )
                    )}
                  </>
                }
              />
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="eye" size={14} />}
                    name={t('contextMenu.viewOption')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createShowMenus(app.value, i18n.value).map(menu => (
                      <ContextMenu.Item
                        onClick={menu.onClick}
                        children={
                          <ContextMenu.Menu
                            icon={
                              menu.checked ? (
                                <Icon name="check" size={14} />
                              ) : null
                            }
                            name={menu.name}
                          />
                        }
                      />
                    ))}
                  </>
                }
              />
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="database" size={14} />}
                    name={t('common.database')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createDatabaseMenus(app.value).map(menu => (
                      <ContextMenu.Item
                        onClick={menu.onClick}
                        children={
                          <ContextMenu.Menu
                            icon={
                              menu.checked ? (
                                <Icon name="check" size={14} />
                              ) : null
                            }
                            name={menu.name}
                          />
                        }
                      />
                    ))}
                  </>
                }
              />
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="file-input" size={14} />}
                    name={t('common.import')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createImportMenus(app.value, props.onClose).map(menu => (
                      <ContextMenu.Item
                        onClick={menu.onClick}
                        children={
                          <ContextMenu.Menu
                            icon={<Icon name={menu.icon} size={14} />}
                            name={menuLabel(i18n.value, menu)}
                          />
                        }
                      />
                    ))}
                  </>
                }
              />
              {app.value.store.getReadonly() ? null : (
                <ContextMenu.Item
                  children={
                    <ContextMenu.Menu
                      icon={<Icon name="file-input" size={14} />}
                      name={t('common.importAndAdd')}
                      right={chevronRightIcon}
                    />
                  }
                  subChildren={
                    <>
                      {createImportMenus(
                        app.value,
                        props.onClose,
                        'append'
                      ).map(menu => (
                        <ContextMenu.Item
                          onClick={menu.onClick}
                          children={
                            <ContextMenu.Menu
                              icon={<Icon name={menu.icon} size={14} />}
                              name={menuLabel(i18n.value, menu)}
                            />
                          }
                        />
                      ))}
                    </>
                  }
                />
              )}
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="file-output" size={14} />}
                    name={t('common.export')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createExportMenus(
                      app.value,
                      props.onClose,
                      i18n.value
                    ).map(menu => (
                      <ContextMenu.Item
                        onClick={menu.onClick}
                        children={
                          <ContextMenu.Menu
                            icon={<Icon name={menu.icon} size={14} />}
                            name={menu.name}
                          />
                        }
                      />
                    ))}
                  </>
                }
              />
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="wand-sparkles" size={14} />}
                    name={t('common.autoLayout')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={
                  <>
                    {createTablePlacementMenus(app.value, props.onClose).map(
                      menu => (
                        <ContextMenu.Item
                          onClick={menu.onClick}
                          children={
                            <ContextMenu.Menu
                              icon={<Icon name={menu.iconName} size={14} />}
                              name={menuLabel(i18n.value, menu)}
                            />
                          }
                        />
                      )
                    )}
                  </>
                }
              />
              <ContextMenu.Item
                onClick={handleOpenDiffViewer}
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="file-diff" size={14} />}
                    name={t('contextMenu.diffViewer')}
                  />
                }
              />
            </>
          )
        }
      />
    );
  };
};

export default ErdContextMenu;
