import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import { toolbarCompass } from '@/components/erd/floating-toolbar/ToolbarCompass.template';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { useSceneSource } from '@/components/sceneSourceContext';
import { RelationshipType } from '@/constants/schema';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import {
  changeDrawTableGroupAction,
  changeHandToolAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import type { PlainMessageKey } from '@/i18n/translate';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import { toZoomFormat } from '@/utils/validation';

import * as styles from './FloatingToolbar.styles';

export type FloatingToolbarProps = {};

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
 * The bar over the bottom of the canvas: which of the two a press means, the
 * zoom, the notation the next relationship is drawn in, zen mode, and which
 * way the content lies once the screen holds none. It is the one surface zen mode leaves standing.
 */
const FloatingToolbar: FC<FloatingToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);

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

  const handleZoomStep = (step: number) => () => {
    const { store } = app.value;
    store.dispatch(streamZoomLevelAction$(step));
  };

  // Absolute, the way the reset chord is, so it holds the middle of the screen.
  const handleZoomReset = () => {
    const { store } = app.value;
    store.dispatch(changeZoomLevelAction$(ZOOM_RESET));
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
    const { editor, settings } = store.state;
    const drawing = editor.drawRelationship?.relationshipType;
    const compass = getContentCompass(store.state, sourceRef.value);
    const title = (labelKey: PlainMessageKey, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, t(labelKey), keyBindingName);

    return (
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
        <div
          class={styles.menu}
          title={title('floatingToolbar.zoomOut', KeyBindingName.zoomOut)}
          on:click={handleZoomStep(-ZOOM_STEP)}
        >
          <Icon name="minus" size={ICON_SIZE} />
        </div>
        <div
          class={['zoom-level', styles.readout]}
          title={title('floatingToolbar.resetZoom', KeyBindingName.zoomReset)}
          on:click={handleZoomReset}
        >
          {toZoomFormat(settings.zoomLevel)}
        </div>
        <div
          class={styles.menu}
          title={title('floatingToolbar.zoomIn', KeyBindingName.zoomIn)}
          on:click={handleZoomStep(ZOOM_STEP)}
        >
          <Icon name="plus" size={ICON_SIZE} />
        </div>
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
    );
  };
};

export default FloatingToolbar;
