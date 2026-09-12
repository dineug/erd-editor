import { query } from '@dineug/erd-editor-schema';
import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Icon from '@/components/primitives/icon/Icon';
import { vertical } from '@/components/toolbar/Toolbar.styles';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  VIEW_HOP_MAX,
  VIEW_HOP_MIN,
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewHistoryMoveAction,
} from '@/engine/modules/editor/view.actions';
import { refitFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

import { leaveFocusView } from './focusExit';
import { placeFocusView } from './focusLayout';
import * as styles from './FocusView.styles';

export type FocusBarProps = {};

const ICON_SIZE = 16;

/** The two reaches the bar offers, each as the button that picks it. */
const HOPS = [VIEW_HOP_MIN, VIEW_HOP_MAX];

const SHOW_MODES: Array<{ value: ShowMode; label: string; title: string }> = [
  { value: ShowMode.keysOnly, label: 'Keys', title: 'Keys only' },
  { value: ShowMode.allFields, label: 'All', title: 'All fields' },
];

/** What the centers are called on the bar: the first by name, the rest by count. */
function centersLabel(names: string[]): string {
  const [first = '', ...rest] = names.map(name => name || 'unnamed');

  return rest.length ? `${first} and ${rest.length} more` : first;
}

function neighboursLabel(count: number): string {
  return `${count} ${count === 1 ? 'neighbour' : 'neighbours'}`;
}

/**
 * The bar over the Focus overlay: what the view stands on and how far it
 * reaches, the rows it shows, the trail of centers behind and ahead, and the
 * fit, the placement and the way out. Every control names the Focus slot.
 */
const FocusBar: FC<FocusBarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  // A press on the reach or the rows the view already has changes nothing,
  // and dispatches nothing, so what a drag moved is not placed over for it.
  const handleHop = (value: number) => () => {
    const { store } = app.value;
    if (store.state.editor.views.focus?.hop === value) return;
    store.dispatch(viewChangeHopAction({ value }));
  };

  const handleShowMode = (value: ShowMode) => () => {
    const { store } = app.value;
    if (store.state.editor.views.focus?.showMode === value) return;
    store.dispatch(viewChangeShowModeAction({ value, kind: ViewKind.focus }));
  };

  const handleHistory = (delta: number, enabled: boolean) => () => {
    if (!enabled) return;
    app.value.store.dispatch(viewHistoryMoveAction({ delta }));
  };

  const handleFit = () => {
    app.value.store.dispatch(refitFocusViewAction$());
  };

  const handleTidyUp = () => {
    placeFocusView(app.value);
  };

  const handleClose = () => {
    leaveFocusView(app.value.store);
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { state } = store;
    const view = state.editor.views.focus;
    if (!view) return null;

    const { history } = view;
    const canBack = history.cursor > 0;
    const canForward = history.cursor < history.entries.length - 1;
    const centers = query(state.collections)
      .collection('tableEntities')
      .selectByIds(view.centerIds);
    const shown = getVisibleIds(state, ViewKind.focus).tableIds;
    const neighbours = shown.filter(id => !view.centerIds.includes(id)).length;

    return (
      <div class={['focus-bar', styles.bar]}>
        <div class={['focus-centers', styles.label]}>
          {centersLabel(centers.map(table => table.name))}
        </div>
        <div class={['focus-neighbours', styles.label]}>
          {neighboursLabel(neighbours)}
        </div>
        <div class={vertical}></div>
        {HOPS.map(hop => (
          <div
            class={[styles.menu, { active: view.hop === hop }]}
            title={`${hop} ${hop === 1 ? 'hop' : 'hops'}`}
            on:click={handleHop(hop)}
          >
            {hop}
          </div>
        ))}
        <div class={vertical}></div>
        {SHOW_MODES.map(mode => (
          <div
            class={[styles.menu, { active: view.showMode === mode.value }]}
            title={mode.title}
            on:click={handleShowMode(mode.value)}
          >
            {mode.label}
          </div>
        ))}
        <div class={vertical}></div>
        <div
          class={[styles.menu, { disabled: !canBack }]}
          title="Back"
          on:click={handleHistory(-1, canBack)}
        >
          <Icon name="arrow-left" size={ICON_SIZE} />
        </div>
        <div
          class={[styles.menu, { disabled: !canForward }]}
          title="Forward"
          on:click={handleHistory(1, canForward)}
        >
          <Icon name="arrow-right" size={ICON_SIZE} />
        </div>
        <div class={vertical}></div>
        <div class={styles.menu} title="Fit" on:click={handleFit}>
          <Icon name="fullscreen" size={ICON_SIZE} />
        </div>
        <div class={styles.menu} title="Tidy Up" on:click={handleTidyUp}>
          <Icon name="wand-sparkles" size={ICON_SIZE} />
        </div>
        <div class={vertical}></div>
        <div
          class={styles.menu}
          title={toShortcutTitle(keyBindingMap, 'Close', KeyBindingName.stop)}
          on:click={handleClose}
        >
          <Icon name="x" size={ICON_SIZE} />
        </div>
      </div>
    );
  };
};

export default FocusBar;
