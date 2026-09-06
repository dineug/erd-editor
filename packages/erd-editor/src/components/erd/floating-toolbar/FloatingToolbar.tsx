import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Icon from '@/components/primitives/icon/Icon';
import { NotationIconName } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';
import {
  changeHandToolAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

import * as styles from './FloatingToolbar.styles';

export type FloatingToolbarProps = {};

const ICON_SIZE = 16;

type Notation = {
  iconName: NotationIconName;
  name: string;
  relationshipType: number;
  keyBindingName: KeyBindingName;
};

const NOTATIONS: Notation[] = [
  {
    iconName: 'ZeroOne',
    name: 'Zero One',
    relationshipType: RelationshipType.ZeroOne,
    keyBindingName: KeyBindingName.relationshipZeroOne,
  },
  {
    iconName: 'ZeroN',
    name: 'Zero N',
    relationshipType: RelationshipType.ZeroN,
    keyBindingName: KeyBindingName.relationshipZeroN,
  },
  {
    iconName: 'OneOnly',
    name: 'One Only',
    relationshipType: RelationshipType.OneOnly,
    keyBindingName: KeyBindingName.relationshipOneOnly,
  },
  {
    iconName: 'OneN',
    name: 'One N',
    relationshipType: RelationshipType.OneN,
    keyBindingName: KeyBindingName.relationshipOneN,
  },
];

/**
 * The tools over the canvas: which of the two a press means, the notation the
 * next relationship is drawn in, and zen mode. It is the one surface zen mode
 * leaves standing, because the way out of zen mode is in it.
 */
const FloatingToolbar: FC<FloatingToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleHandTool = (value: boolean) => () => {
    const { store } = app.value;
    store.dispatch(changeHandToolAction({ value }));
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

  const handleZenMode = () => {
    const { store } = app.value;
    store.dispatch(changeZenModeAction({ value: !store.state.editor.zenMode }));
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { editor } = store.state;
    const drawing = editor.drawRelationship?.relationshipType;
    const title = (name: string, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, name, keyBindingName);

    return (
      <div class={['floating-toolbar', styles.root]}>
        <div
          class={[styles.menu, { active: editor.handTool }]}
          title={title('Hand', KeyBindingName.handTool)}
          on:click={handleHandTool(true)}
        >
          <Icon name="hand" size={ICON_SIZE} />
        </div>
        <div
          class={[styles.menu, { active: !editor.handTool }]}
          title={title('Select', KeyBindingName.handTool)}
          on:click={handleHandTool(false)}
        >
          <Icon name="mouse-pointer-2" size={ICON_SIZE} />
        </div>
        <div class={styles.divider}></div>
        {NOTATIONS.map(notation => (
          <div
            class={[
              styles.menu,
              { active: drawing === notation.relationshipType },
            ]}
            title={title(notation.name, notation.keyBindingName)}
            on:click={handleDrawRelationship(notation.relationshipType)}
          >
            <Icon name={notation.iconName} size={ICON_SIZE} />
          </div>
        ))}
        <div class={styles.divider}></div>
        <div
          class={['zen-mode', styles.menu, { active: editor.zenMode }]}
          title={title('Zen Mode', KeyBindingName.zenMode)}
          on:click={handleZenMode}
        >
          {editor.zenMode ? (
            <Icon name="minimize" size={ICON_SIZE} />
          ) : (
            <Icon name="maximize" size={ICON_SIZE} />
          )}
        </div>
      </div>
    );
  };
};

export default FloatingToolbar;
