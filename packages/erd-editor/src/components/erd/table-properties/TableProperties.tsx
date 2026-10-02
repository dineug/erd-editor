import { query } from '@dineug/erd-editor-schema';
import { FC, nextTick, observable, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import TablePropertiesIndexes from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes';
import TablePropertiesTabs, {
  Tab,
} from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs';
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import Icon from '@/components/primitives/icon/Icon';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { onStop } from '@/utils/domEvent';
import { focusEvent } from '@/utils/internalEvents';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

import * as styles from './TableProperties.styles';

export type TablePropertiesProps = {
  isDarkMode: boolean;
  /** The editor's readonly mode, which the dialog shows and its controls follow; the store refuses the edits anyway. */
  readonly?: boolean;
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

  /**
   * The close button held the keyboard, and it leaves with the dialog: the
   * editor takes the focus back, or the keyboard falls to the page and every
   * shortcut stops.
   */
  const handleCloseButton = () => {
    handleClose();
    nextTick(() => {
      ctx.host.dispatchEvent(focusEvent());
    });
  };

  /**
   * Space is the hand tool's key wherever no caret is, and the editor cancels
   * its keydown, which takes the click from a native button. Kept here, Space
   * presses the button as Enter does; Escape still bubbles up to close.
   */
  const handleCloseKeydown = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.stopPropagation();
    }
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
    const { store, keyBindingMap } = app.value;
    const { collections } = store.state;
    const { tableIds } = props;

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);

    return (
      <div
        class={styles.root}
        on:contextmenu={onStop}
        on:mousedown={onStop}
        on:touchstart={onStop}
        on:wheel={onStop}
        on:click={handleOutsideClick}
      >
        <div
          class={['table-properties', styles.container]}
          role="dialog"
          aria-label="Table Properties"
        >
          <div class={styles.header}>
            <span class={styles.title}>Table Properties</span>
            {props.readonly ? (
              <span class={styles.readonlyBadge}>
                <Icon name="lock" size={12} />
                <span>Read only</span>
              </span>
            ) : null}
            <div class={['scrollbar', styles.tables]}>
              {tables.map(table => (
                <div
                  class={[
                    styles.tableChip,
                    { selected: table.id === props.tableId },
                  ]}
                  title={table.name}
                  on:click={() => props.onChange(table.id)}
                >
                  <span>{table.name.trim() ? table.name : 'unnamed'}</span>
                </div>
              ))}
            </div>
            <button
              class={['table-properties-close', styles.close]}
              type="button"
              title={toShortcutTitle(
                keyBindingMap,
                'Close',
                KeyBindingName.stop
              )}
              on:click={handleCloseButton}
              on:keydown={handleCloseKeydown}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <TablePropertiesTabs value={state.tab} onChange={handleChangeTab} />
          <div class={['scrollbar', styles.scrollbarArea]}>
            {state.tab === Tab.Indexes ? (
              <div class={styles.scope}>
                <TablePropertiesIndexes
                  tableId={props.tableId}
                  readonly={props.readonly}
                />
              </div>
            ) : state.tab === Tab.SchemaSQL ? (
              <div class={['code', styles.scope]}>
                <SchemaSQL
                  isDarkMode={props.isDarkMode}
                  tableId={props.tableId}
                />
              </div>
            ) : state.tab === Tab.GeneratorCode ? (
              <div class={['code', styles.scope]}>
                <GeneratorCode
                  isDarkMode={props.isDarkMode}
                  tableId={props.tableId}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };
};

export default TableProperties;
