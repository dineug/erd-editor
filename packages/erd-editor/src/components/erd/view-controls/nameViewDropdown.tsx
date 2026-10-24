import {
  createRef,
  type DOMTemplateLiterals,
  observable,
  onMounted,
  onUpdated,
  ref,
} from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { nameViewOptions } from '@/components/erd/nameViewOptions';
import { useI18n } from '@/components/localeContext';
import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import { Open } from '@/constants/open';
import type { NameViewMode } from '@/constants/schema';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Ctx, ValuesType } from '@/internal-types';
import { middlePanPress$ } from '@/utils/globalEventObservable';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './nameViewDropdown.styles';

const CHEVRON_SIZE = 12;
const MENU_ICON_SIZE = 14;

/** Between the top of the trigger and the bottom of the menu it opens. */
const MENU_GAP = 8;

export type NameViewDropdown = {
  /** The button in the bar, which names the view in force. */
  trigger: () => DOMTemplateLiterals;
  /** The menu over it, drawn beside the bar, whose transform would move it. */
  menu: () => DOMTemplateLiterals | null;
  close: () => void;
};

/**
 * The Name View list a floating bar offers over itself, the view in force
 * checked. A pick switches the reader's own view, and the document's once its
 * lock is off, as the canvas menu's does (toNameViewModeAction).
 */
export function useNameViewDropdown(ctx: Ctx): NameViewDropdown {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();
  const $trigger = createRef<HTMLDivElement>();
  const $menu = createRef<HTMLDivElement>();
  const state = observable({ open: false, x: 0, y: 0 });
  let stopListening: (() => void) | null = null;

  const close = () => {
    state.open = false;
    stopListening?.();
    stopListening = null;
  };

  // Written only on a move, or the pass this runs after would schedule the
  // next one and the two would hand the anchor back and forth for ever.
  const anchor = () => {
    const trigger = $trigger.value;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - MENU_GAP;
    if (state.x !== x) state.x = x;
    if (state.y !== y) state.y = y;
  };

  const toggle = () => {
    const trigger = $trigger.value;
    if (state.open || !trigger) {
      close();
      return;
    }
    anchor();
    state.open = true;
    listen(trigger.getRootNode());
  };

  const pick = (value: ValuesType<typeof NameViewMode>) => () => {
    close();
    const { store } = app.value;
    store.dispatch(
      toNameViewModeAction(store.state, value, store.getReadonly())
    );
  };

  /** A press outside the trigger and the menu shuts it, read off the tree the bar stands in. */
  const handlePress = (event: Event) => {
    if (!state.open) return;

    const target = event.target as Node | null;
    if (!target) return;
    if ($menu.value?.contains(target) || $trigger.value?.contains(target)) {
      return;
    }
    close();
  };

  // The palette's own Escape is the palette's, as the tab's gate reads it.
  const handleShortcut = ({ type }: { type: KeyBindingName }) => {
    if (type !== KeyBindingName.stop) return;
    if (app.value.store.state.editor.openMap[Open.search]) return;
    close();
  };

  /**
   * Hears presses on the tree the trigger stands in while the list is open: the
   * element's shadow root is closed, so a listener above it is handed the host
   * as the target of every press inside, the menu's own included.
   */
  function listen(root: Node) {
    const presses = [
      fromEvent(root, 'mousedown').subscribe(handlePress),
      middlePanPress$(root).subscribe(handlePress),
    ];
    stopListening = () => presses.forEach(press => press.unsubscribe());
  }

  onMounted(() => {
    addUnsubscribe(app.value.shortcut$.subscribe(handleShortcut), () =>
      stopListening?.()
    );
  });

  // The bar is centred, so a tool joining or leaving it slides the trigger
  // sideways under an open menu; the anchor is taken again on every pass.
  onUpdated(() => {
    if (state.open) anchor();
  });

  const trigger = () => {
    const { t } = i18n.value;
    const current = app.value.store.state.settings.nameViewMode;

    return (
      <div
        use:ref={ref($trigger)}
        class={['name-view-trigger', styles.trigger, { active: state.open }]}
        title={t('common.nameView')}
        on:click={toggle}
      >
        <div class={styles.label}>
          {nameViewOptions.map(view => (
            <span
              class={view.value === current ? null : styles.hidden}
              aria-hidden={view.value === current ? 'false' : 'true'}
            >
              {t(view.labelKey)}
            </span>
          ))}
        </div>
        <Icon name="chevron-down" size={CHEVRON_SIZE} />
      </div>
    );
  };

  const menu = () => {
    if (!state.open) return null;

    const { t } = i18n.value;
    const current = app.value.store.state.settings.nameViewMode;

    return (
      <div use:ref={ref($menu)} class={['name-view-menu', styles.menu]}>
        <ContextMenuContent
          id="name-view"
          x={state.x}
          y={state.y}
          children={
            <>
              {nameViewOptions.map(view => (
                <ContextMenu.Item
                  onClick={pick(view.value)}
                  children={
                    <ContextMenu.Menu
                      icon={
                        view.value === current ? (
                          <Icon name="check" size={MENU_ICON_SIZE} />
                        ) : null
                      }
                      name={t(view.labelKey)}
                    />
                  }
                />
              ))}
            </>
          }
        />
      </div>
    );
  };

  return { trigger, menu, close };
}
