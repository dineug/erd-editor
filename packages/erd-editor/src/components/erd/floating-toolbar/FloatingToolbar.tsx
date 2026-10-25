import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import { useNameViewDropdown } from '@/components/erd/view-controls/nameViewDropdown';
import { toolbarCompass } from '@/components/erd/view-controls/ToolbarCompass.template';
import { useZoomControls } from '@/components/erd/view-controls/zoomControls';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { useSceneSource } from '@/components/sceneSourceContext';
import { RelationshipType } from '@/constants/schema';
import {
  changeDrawTableGroupAction,
  changeHandToolAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import type { PlainMessageKey } from '@/i18n/translate';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import { isMemoShown } from '@/utils/memo';
import { isTableGroupShown } from '@/utils/tableGroup';

import * as styles from './FloatingToolbar.styles';

export type FloatingToolbarProps = {
  /** The editor's readonly, under which the bar offers nothing to add. */
  readonly?: boolean;
};

const ICON_SIZE = 16;

type Notation = {
  iconName: NotationIconName;
  labelKey: PlainMessageKey;
  relationshipType: number;
  keyBindingName: KeyBindingName;
};

const NOTATIONS: Notation[] = [
  {
    iconName: 'ZeroOne',
    labelKey: 'common.relationshipType.zeroOne',
    relationshipType: RelationshipType.ZeroOne,
    keyBindingName: KeyBindingName.relationshipZeroOne,
  },
  {
    iconName: 'ZeroN',
    labelKey: 'common.relationshipType.zeroN',
    relationshipType: RelationshipType.ZeroN,
    keyBindingName: KeyBindingName.relationshipZeroN,
  },
  {
    iconName: 'OneOnly',
    labelKey: 'common.relationshipType.oneOnly',
    relationshipType: RelationshipType.OneOnly,
    keyBindingName: KeyBindingName.relationshipOneOnly,
  },
  {
    iconName: 'OneN',
    labelKey: 'common.relationshipType.oneN',
    relationshipType: RelationshipType.OneN,
    keyBindingName: KeyBindingName.relationshipOneN,
  },
];

/**
 * The bar over the bottom of the canvas: which of the two a press means, what
 * to add, the zoom, the notation the next relationship is drawn in, the name view, zen mode,
 * and which way the content lies once the screen holds none. It is the one surface zen mode leaves standing.
 */
const FloatingToolbar: FC<FloatingToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);
  const zoom = useZoomControls(ctx);
  const nameView = useNameViewDropdown(ctx);

  // Select is the plain pointer, so it ends a table group draw armed as well,
  // which the hand going up ends on its own.
  const handleHandTool = (value: boolean) => () => {
    const { store } = app.value;
    store.dispatch(
      changeHandToolAction({ value }),
      ...(store.state.editor.drawTableGroup
        ? [changeDrawTableGroupAction({ value: false })]
        : [])
    );
  };

  const handleAddTable = () => {
    const { store } = app.value;
    store.dispatch(addTableAction$());
  };

  const handleAddMemo = () => {
    const { store } = app.value;
    store.dispatch(addMemoAction$());
  };

  /**
   * Arms the table group draw, whose next main press on the canvas draws the
   * group, and a second press disarms it, as a notation's does.
   */
  const handleAddTableGroup = () => {
    const { store } = app.value;
    store.dispatch(
      changeDrawTableGroupAction({ value: !store.state.editor.drawTableGroup })
    );
  };

  /**
   * A notation is drawn by pressing the two tables it joins, which the hand
   * would pan over instead, so picking one puts the pointer back in hand.
   */
  const handleDrawRelationship = (relationshipType: number) => () => {
    const { store } = app.value;
    store.dispatch(
      changeHandToolAction({ value: false }),
      drawStartRelationshipAction$(relationshipType)
    );
  };

  const handleCompass = () => {
    scrollToNearestContent(app.value.store, sourceRef.value);
  };

  const handleZenMode = () => {
    const { store } = app.value;
    store.dispatch(changeZenModeAction({ value: !store.state.editor.zenMode }));
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { t } = i18n.value;
    const { editor } = store.state;
    const drawing = editor.drawRelationship?.relationshipType;
    const compass = getContentCompass(store.state, sourceRef.value);
    const title = (labelKey: PlainMessageKey, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, t(labelKey), keyBindingName);

    return (
      <>
        <div class={['floating-toolbar', styles.root]} prop:dir="ltr">
          <div
            class={[styles.menu, { active: editor.handTool }]}
            title={title('floatingToolbar.hand', KeyBindingName.handTool)}
            on:click={handleHandTool(true)}
          >
            <Icon name="hand" size={ICON_SIZE} />
          </div>
          <div
            class={[
              styles.menu,
              { active: !editor.handTool && !editor.drawTableGroup },
            ]}
            title={title('floatingToolbar.select', KeyBindingName.handTool)}
            on:click={handleHandTool(false)}
          >
            <Icon name="mouse-pointer-2" size={ICON_SIZE} />
          </div>
          <div class={styles.divider}></div>
          {props.readonly ? null : (
            <>
              <div
                class={['add-table', styles.menu]}
                title={title('common.newTable', KeyBindingName.addTable)}
                on:click={handleAddTable}
              >
                <Icon name="table-2" size={ICON_SIZE} />
              </div>
              {isMemoShown(store.state) ? (
                <div
                  class={['add-memo', styles.menu]}
                  title={title('common.newMemo', KeyBindingName.addMemo)}
                  on:click={handleAddMemo}
                >
                  <Icon name="sticky-note" size={ICON_SIZE} />
                </div>
              ) : null}
              {isTableGroupShown(store.state) ? (
                <div
                  class={[
                    'add-table-group',
                    styles.menu,
                    { active: editor.drawTableGroup },
                  ]}
                  title={title(
                    'common.newTableGroup',
                    KeyBindingName.addTableGroup
                  )}
                  on:click={handleAddTableGroup}
                >
                  <Icon name="group" size={ICON_SIZE} />
                </div>
              ) : null}
              <div class={styles.divider}></div>
            </>
          )}
          {zoom()}
          <div class={styles.divider}></div>
          {NOTATIONS.map(notation => (
            <div
              class={[
                styles.menu,
                { active: drawing === notation.relationshipType },
              ]}
              title={title(notation.labelKey, notation.keyBindingName)}
              on:click={handleDrawRelationship(notation.relationshipType)}
            >
              <Icon name={notation.iconName} size={ICON_SIZE} />
            </div>
          ))}
          <div class={styles.divider}></div>
          {nameView.trigger()}
          <div class={styles.divider}></div>
          <div
            class={['zen-mode', styles.menu, { active: editor.zenMode }]}
            title={title('floatingToolbar.zenMode', KeyBindingName.zenMode)}
            on:click={handleZenMode}
          >
            {editor.zenMode ? (
              <Icon name="minimize" size={ICON_SIZE} />
            ) : (
              <Icon name="maximize" size={ICON_SIZE} />
            )}
          </div>
          {toolbarCompass({
            compass,
            title: t('floatingToolbar.goToContent'),
            className: 'content-compass',
            onClick: handleCompass,
          })}
        </div>
        {nameView.menu()}
      </>
    );
  };
};

export default FloatingToolbar;
