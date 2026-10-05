import {
  createRef,
  FC,
  observable,
  onUpdated,
  ref,
  repeat,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Button from '@/components/primitives/button/Button';
import Menu from '@/components/primitives/context-menu/menu/Menu';
import Icon from '@/components/primitives/icon/Icon';
import Separator from '@/components/primitives/separator/Separator';
import Switch from '@/components/primitives/switch/Switch';
import TextInput from '@/components/primitives/text-input/TextInput';
import Toast from '@/components/primitives/toast/Toast';
import { lockSettingRows } from '@/components/settings/lockSettingRows';
import SettingsLnb, {
  Lnb,
} from '@/components/settings/settings-lnb/SettingsLnb';
import Shortcuts from '@/components/settings/shortcuts/Shortcuts';
import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { CanvasType, ColumnTypeToName } from '@/constants/schema';
import {
  changeColumnOrderAction,
  changeMaxWidthCommentAction,
  changeRelationshipDataTypeSyncAction,
} from '@/engine/modules/settings/atom.actions';
import { changeLockSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import { fontSize6 } from '@/styles/typography.styles';
import { bHas } from '@/utils/bit';
import { recalculateTableWidth } from '@/utils/calcTable';
import { onPrevent } from '@/utils/domEvent';
import { relationshipSort } from '@/utils/draw-relationship/sort';
import { openToastAction } from '@/utils/emitter';
import { FlipAnimation } from '@/utils/flipAnimation';
import { delay } from '@/utils/promise';
import { fromShadowDraggable } from '@/utils/rx-operators/fromShadowDraggable';
import {
  maxWidthCommentInRange,
  toMaxWidthCommentFormat,
  toNumString,
} from '@/utils/validation';

import * as styles from './Settings.styles';

export type SettingsProps = {};

const Settings: FC<SettingsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  // The held row is left out: it snaps to its slot on each reorder, and only
  // the rows it pushes aside slide, so the list never paints out of order.
  const flipAnimation = new FlipAnimation(
    root,
    `.${styles.columnOrderItem}:not(.dragging)`,
    'column-order-move'
  );

  const state = observable({
    lnb: Lnb.preferences as Lnb,
  });

  const handleChangeRelationshipDataTypeSync = (value: boolean) => {
    const { store } = app.value;
    store.dispatch(changeRelationshipDataTypeSyncAction({ value }));
  };

  const handleRecalculationTableWidth = () => {
    const { store, emitter, toWidth } = app.value;
    recalculateTableWidth(store.state, { toWidth, clock: store.context.clock });
    relationshipSort(store.state);
    emitter.emit(
      openToastAction({
        close: delay(2000),
        message: <Toast title="Recalculated table width" />,
      })
    );
  };

  const handleChangeColumnOrderAction = (value: number, target: number) => {
    const { store } = app.value;

    if (value !== target) {
      flipAnimation.snapshot();
      store.dispatch(changeColumnOrderAction({ value, target }));
    }
  };

  const handleDragstartColumnOrder = (event: DragEvent) => {
    const $root = root.value;
    const $target = event.target as HTMLElement | null;
    if (!$root || !$target) return;

    const id = $target.dataset?.id;
    if (!id) return;

    const columnType = Number(id);
    const elements = Array.from<HTMLElement>(
      $root.querySelectorAll(`.${styles.columnOrderItem}`)
    );
    elements.forEach(el => el.classList.add('none-hover'));
    $target.classList.add('dragging');

    fromShadowDraggable(elements, el => el.dataset.id as string).subscribe({
      next: target => {
        handleChangeColumnOrderAction(columnType, Number(target));
      },
      complete: () => {
        $target.classList.remove('dragging');
        elements.forEach(el => el.classList.remove('none-hover'));
      },
    });
  };

  onUpdated(() => flipAnimation.play());

  const handleChangeLnb = (value: Lnb) => {
    state.lnb = value;
  };

  const handleSwitchMaxWidthComment = (checked: boolean) => {
    const { store } = app.value;
    store.dispatch(
      changeMaxWidthCommentAction({ value: checked ? COLUMN_MIN_WIDTH : -1 })
    );
  };

  const handleChangeMaxWidthComment = (event: Event) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const maxWidthComment = maxWidthCommentInRange(
      Number(toNumString(el.value))
    );
    const { store } = app.value;
    el.value = toMaxWidthCommentFormat(maxWidthComment);
    store.dispatch(changeMaxWidthCommentAction({ value: maxWidthComment }));
  };

  const handleChangeLock = (lockSettingType: number, value: boolean) => {
    const { store } = app.value;
    store.dispatch(changeLockSettingsAction$(lockSettingType, value));
  };

  return () => {
    const { store } = app.value;
    const { settings } = store.state;
    const maxWidthCommentDisabled = settings.maxWidthComment === -1;
    // On the Settings tab an unlocked row names the tab a lock would take,
    // the one the reader came from, as changeLockSettingsAction$ reads it.
    const liveValues = {
      ...settings,
      canvasType:
        settings.canvasType === CanvasType.settings
          ? store.state.editor.lastCanvasType
          : settings.canvasType,
    };

    return (
      <div class={styles.root} use:ref={ref(root)}>
        <div class={styles.lnbArea}>
          <SettingsLnb value={state.lnb} onChange={handleChangeLnb} />
        </div>
        <div class={styles.contentArea}>
          <div class={fontSize6}>{state.lnb}</div>
          <Separator space={12} />
          <div class={['scrollbar', styles.content]}>
            {state.lnb === Lnb.preferences ? (
              <div class={styles.section}>
                <div class={styles.row}>
                  <div>Relationship DataType Sync</div>
                  <div class={styles.vertical(16)}></div>
                  <Switch
                    value={settings.relationshipDataTypeSync}
                    onChange={handleChangeRelationshipDataTypeSync}
                  />
                </div>

                <div class={styles.row}>
                  <div>Maximum comment width</div>
                  <div class={styles.vertical(16)}></div>
                  <Switch
                    value={!maxWidthCommentDisabled}
                    onChange={handleSwitchMaxWidthComment}
                  />
                  <div class={styles.vertical(8)}></div>
                  <TextInput
                    title="Maximum comment width"
                    placeholder="Maximum comment width"
                    width={45}
                    value={
                      maxWidthCommentDisabled
                        ? toMaxWidthCommentFormat(COLUMN_MIN_WIDTH)
                        : toMaxWidthCommentFormat(settings.maxWidthComment)
                    }
                    disabled={maxWidthCommentDisabled}
                    numberOnly={true}
                    onChange={handleChangeMaxWidthComment}
                  />
                </div>

                <div class={styles.row}>
                  <div>Recalculation table width</div>
                  <div class={styles.vertical(16)}></div>
                  <Button
                    variant="soft"
                    size="1"
                    text={
                      <>
                        <Icon size={14} name="refresh-cw" />
                        <div class={styles.vertical(8)}></div>
                        <span>Sync</span>
                      </>
                    }
                    onClick={handleRecalculationTableWidth}
                  />
                </div>
                <div class={styles.lockSection}>
                  <div>Lock</div>
                  <Separator space={12} />
                  {lockSettingRows.map(row => {
                    const locked = bHas(
                      settings.lockSettings,
                      row.lockSettingType
                    );

                    return (
                      <div class={styles.lockRow}>
                        <div class={styles.lockName}>{row.name}</div>
                        <div
                          class={styles.lockValue}
                          bool:data-locked={locked}
                          title={locked ? 'Locked value' : 'Current value'}
                        >
                          {row.toText(
                            locked ? settings.lockedValues : liveValues
                          )}
                        </div>
                        <button
                          class={styles.lockButton}
                          type="button"
                          title={`${locked ? 'Unlock' : 'Lock'} ${row.name}`}
                          aria-pressed={locked ? 'true' : 'false'}
                          bool:data-locked={locked}
                          on:click={() =>
                            handleChangeLock(row.lockSettingType, !locked)
                          }
                        >
                          {locked ? (
                            <Icon name="lock" size={14} />
                          ) : (
                            <Icon name="lock-open" size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div class={styles.columnOrderSection}>
                  <div>Column Order</div>
                  <Separator space={12} />
                  <div
                    class={styles.columnOrderList}
                    on:dragenter={onPrevent}
                    on:dragover={onPrevent}
                  >
                    {repeat(
                      settings.columnOrder,
                      columnType => columnType,
                      columnType => (
                        <div
                          class={styles.columnOrderItem}
                          draggable="true"
                          data-id={columnType}
                          on:dragstart={handleDragstartColumnOrder}
                        >
                          <Menu
                            icon={<Icon name="grip-vertical" size={14} />}
                            name={ColumnTypeToName[columnType]}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : state.lnb === Lnb.shortcuts ? (
              <Shortcuts />
            ) : null}
          </div>
        </div>
      </div>
    );
  };
};

export default Settings;
