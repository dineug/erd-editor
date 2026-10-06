import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { createImportMenus } from '@/components/erd/erd-context-menu/menus/importMenus';
import WelcomeHints from '@/components/erd/welcome-screen/welcome-hints/WelcomeHints';
import {
  measureAnchors,
  welcomeTiers,
} from '@/components/erd/welcome-screen/welcomeLayout';
import {
  coveredWidth,
  isPanelShown,
} from '@/components/find-replace/panelLayout';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import type { IconName } from '@/components/primitives/icon/icons';
import Kbd from '@/components/primitives/kbd/Kbd';
import { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import { requestSettingsPage } from '@/components/settings/settingsPage';
import { Open } from '@/constants/open';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { TextDirection } from '@/i18n/locales';
import { menuLabel } from '@/i18n/menuLabel';
import { toggleSearchAction } from '@/utils/emitter';
import { focusEvent } from '@/utils/internalEvents';
import { KeyBindingName, matchesShortcut } from '@/utils/keyboard-shortcut';

import * as styles from './WelcomeScreen.styles';

export type WelcomeScreenProps = {
  enableThemeBuilder?: boolean;
  enableLocalePicker?: boolean;
};

type WelcomeRow = {
  icon: IconName;
  label: string;
  shortcut?: string;
  onClick: () => void;
};

type MenuLevel = 'top' | 'import';

/** Where the Import row stands in the menu, which Back hands the keyboard to. */
const IMPORT_ROW = 2;

/** A row's icon as the text runs: the Back arrow points right in a right-to-left language. */
export const rowIcon = (icon: IconName, dir: TextDirection): IconName =>
  icon === 'arrow-left' && dir === 'rtl' ? 'arrow-right' : icon;

/**
 * What an empty diagram shows over its canvas: a heading and a menu of the
 * ways to start, which Import swaps in place for its formats, with hints at
 * the tools around it where the canvas has room.
 */
const WelcomeScreen: FC<WelcomeScreenProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const root = createRef<HTMLDivElement>();
  const menu = createRef<HTMLDivElement>();
  const state = observable({
    level: 'top' as MenuLevel,
    search: null as number | null,
    preferences: null as number | null,
  });
  const { addUnsubscribe } = useUnmounted();

  const measureNow = () => {
    const $root = root.value;
    if (!$root) return;

    const anchors = measureAnchors($root);
    state.search = anchors.search;
    state.preferences = anchors.preferences;
  };

  // One function, so the scheduler runs a burst of triggers as one measure,
  // after the renders they set off have laid the toolbar out.
  const measure = () => {
    nextTick(measureNow);
  };

  // Whether a row holds the keyboard. The screen hears it is leaving only once
  // its rows are gone, so this follows the focus as it moves instead.
  let holdsFocus = false;

  /** A row that takes the menu away hands the keyboard back to the editor. */
  const restoreFocus = () => {
    const host = ctx.host;
    holdsFocus = false;
    nextTick(() => host.dispatchEvent(focusEvent()));
  };

  const handleFocusin = () => {
    holdsFocus = true;
  };

  /**
   * Chromium blurs a row it is about to remove, so the check waits until the
   * removal is done and a screen taken away keeps what it knew; a window that
   * loses focus leaves the row the active element, which still counts.
   */
  const handleFocusout = () => {
    queueMicrotask(() => {
      const $root = root.value;
      if (!$root?.isConnected) return;

      const { activeElement } = $root.getRootNode() as Document | ShadowRoot;
      holdsFocus = activeElement !== null && $root.contains(activeElement);
    });
  };

  const menuRows = () =>
    Array.from(
      menu.value?.querySelectorAll<HTMLElement>('.welcome-screen-item') ?? []
    );

  const focusRow = (index: number) => {
    nextTick(() => {
      menuRows()[index]?.focus({ preventScroll: true });
    });
  };

  const handleNewTable = () => {
    app.value.store.dispatch(addTableAction$());
    restoreFocus();
  };

  const handleNewMemo = () => {
    app.value.store.dispatch(addMemoAction$());
    restoreFocus();
  };

  const handleImport = () => {
    state.level = 'import';
    focusRow(0);
  };

  const handleBack = () => {
    state.level = 'top';
    focusRow(IMPORT_ROW);
  };

  const handlePalette = () => {
    app.value.emitter.emit(toggleSearchAction());
  };

  const handleShortcuts = () => {
    requestSettingsPage(app.value.store, Lnb.shortcuts);
    restoreFocus();
  };

  /**
   * The arrows, Home and End walk the rows round and stay in the menu, Enter
   * and Space stay to press the row, and Escape among the formats goes back;
   * every other chord reaches the editor, so Alt+N still adds a table here.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const rows = menuRows();
    const index = rows.indexOf(event.target as HTMLElement);
    const last = rows.length - 1;

    const move = (next: number) => {
      event.preventDefault();
      event.stopPropagation();
      rows[next]?.focus({ preventScroll: true });
    };

    switch (event.key) {
      case 'ArrowDown':
        move(index < last ? index + 1 : 0);
        return;
      case 'ArrowUp':
        move(index > 0 ? index - 1 : last);
        return;
      case 'Home':
        move(0);
        return;
      case 'End':
        move(last);
        return;
      case 'Enter':
      case ' ':
        event.stopPropagation();
        return;
    }

    const { keyBindingMap } = app.value;
    if (
      state.level === 'import' &&
      matchesShortcut(event, keyBindingMap[KeyBindingName.stop])
    ) {
      event.preventDefault();
      event.stopPropagation();
      handleBack();
    }
  };

  const topRows = (): WelcomeRow[] => {
    const { keyBindingMap } = app.value;
    const { t } = i18n.value;

    return [
      {
        icon: 'table-2',
        label: t('common.newTable'),
        shortcut: keyBindingMap[KeyBindingName.addTable][0]?.shortcut,
        onClick: handleNewTable,
      },
      {
        icon: 'sticky-note',
        label: t('common.newMemo'),
        shortcut: keyBindingMap[KeyBindingName.addMemo][0]?.shortcut,
        onClick: handleNewMemo,
      },
      {
        icon: 'file-input',
        label: t('common.import'),
        onClick: handleImport,
      },
      {
        icon: 'search',
        label: t('welcome.commandPalette'),
        shortcut: keyBindingMap[KeyBindingName.search][0]?.shortcut,
        onClick: handlePalette,
      },
      {
        icon: 'keyboard',
        label: t('common.shortcuts'),
        onClick: handleShortcuts,
      },
    ];
  };

  const importRows = (): WelcomeRow[] => [
    {
      icon: 'arrow-left',
      label: i18n.value.t('welcome.back'),
      onClick: handleBack,
    },
    ...createImportMenus(app.value, handleBack, 'replace').map(row => ({
      icon: row.icon,
      label: menuLabel(i18n.value, row),
      onClick: row.onClick,
    })),
  ];

  onMounted(() => {
    const { store } = app.value;

    measure();
    addUnsubscribe(
      watch(store.state.editor.viewport).subscribe(measure),
      watch(store.state.settings).subscribe(name => {
        name === 'canvasType' && measure();
      }),
      watch(props).subscribe(measure),
      watch(i18n.value).subscribe(name => {
        name === 'dir' && measure();
      })
    );
  });

  // An import that loads tables or a chord pressed on a row empties the
  // document under a focused row, which would leave the keyboard on the body.
  onUnmounted(() => {
    holdsFocus && restoreFocus();
  });

  return () => {
    const { store } = app.value;
    const { viewport, openMap } = store.state.editor;
    const { dir, t } = i18n.value;
    const covered = coveredWidth(store.state);
    const tiers = welcomeTiers({
      width: viewport.width - covered,
      height: viewport.height,
    });
    const panelUp =
      isPanelShown(store.state) ||
      Boolean(openMap[Open.themeBuilder]) ||
      Boolean(openMap[Open.localePicker]);
    const rows = state.level === 'import' ? importRows() : topRows();

    return (
      <div
        class={['welcome-screen', styles.root]}
        style={{ left: `${covered}px` }}
        use:ref={ref(root)}
      >
        {tiers.hints && !panelUp ? (
          <WelcomeHints
            search={state.search}
            preferences={state.preferences}
            width={viewport.width}
            enableThemeBuilder={props.enableThemeBuilder}
            enableLocalePicker={props.enableLocalePicker}
          />
        ) : null}
        {tiers.center === 'none' ? null : (
          <div class={styles.center}>
            {tiers.center === 'full' ? (
              <div class={['welcome-screen-heading', styles.heading]}>
                {t('welcome.heading')}
              </div>
            ) : null}
            <div
              class={['welcome-screen-menu', styles.menu]}
              role="group"
              aria-label={t('welcome.menu')}
              use:ref={ref(menu)}
              on:keydown={handleKeydown}
              on:focusin={handleFocusin}
              on:focusout={handleFocusout}
            >
              {rows.map(row => (
                <button
                  type="button"
                  class={['welcome-screen-item', styles.item]}
                  on:click={row.onClick}
                >
                  <Icon name={rowIcon(row.icon, dir)} size={16} />
                  <span class={styles.label}>{row.label}</span>
                  {tiers.kbd && row.shortcut ? (
                    <Kbd shortcut={row.shortcut} />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
};

export default WelcomeScreen;
