import {
  createRef,
  DOMTemplateLiterals,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import Separator from '@/components/primitives/separator/Separator';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { hasMoveKeys } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import {
  LocaleCode,
  LocaleCodeList,
  localeInfoOf,
  LocaleOption,
  LOCALES,
  SYSTEM_LOCALE,
} from '@/i18n/locales';
import { setLocaleOptionAction } from '@/utils/emitter';
import { focusEvent } from '@/utils/internalEvents';
import {
  isComposing,
  KeyBindingName,
  KeyBindingNameList,
  matchesShortcut,
  PANEL_PASSING_BINDINGS,
} from '@/utils/keyboard-shortcut';

import * as styles from './LocalePicker.styles';

export type LocalePickerProps = {
  /** The option in force, which the panel checks. */
  option: LocaleOption;
  /** The language System stands for now, named beside it. */
  systemLocale: LocaleCode;
};

/** Every row in the order the panel lists them: System, then each language. */
const OPTIONS: ReadonlyArray<LocaleOption> = [SYSTEM_LOCALE, ...LocaleCodeList];

/** The row a key moves to from the one at index, round either end; null for any other key. */
export function stepOption(
  index: number,
  length: number,
  key: string
): number | null {
  switch (key) {
    case 'ArrowDown':
      return (index + 1) % length;
    case 'ArrowUp':
      return (index - 1 + length) % length;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return null;
  }
}

const hasModifier = (event: KeyboardEvent) =>
  event.altKey || event.ctrlKey || event.metaKey;

const LocalePicker: FC<LocalePickerProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const list = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    /** The row the keyboard reaches the list on, which roves with the focus. */
    active: 0,
  });

  const isOpen = () => {
    const { store } = app.value;
    return Boolean(store.state.editor.openMap[Open.localePicker]);
  };

  const rows = () =>
    Array.from(
      list.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []
    );

  /** Puts the keyboard on the checked row, scrolled into the list's view. */
  const focusChecked = () => {
    const row = list.value?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  };

  const open = () => {
    const { store } = app.value;
    state.active = Math.max(0, OPTIONS.indexOf(props.option));
    store.dispatchSync(
      changeOpenMapAction({
        [Open.localePicker]: true,
        [Open.themeBuilder]: false,
        [Open.tableProperties]: false,
      })
    );
    nextTick(focusChecked);
  };

  /** The keyboard may be on a row, which leaves with the panel, so the editor takes it back. */
  const close = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.localePicker]: false }));
    nextTick(() => {
      ctx.host.dispatchEvent(focusEvent());
    });
  };

  const handleToggle = () => {
    isOpen() ? close() : open();
  };

  const handleStop = () => {
    if (isOpen()) close();
  };

  const pick = (locale: LocaleOption) => {
    const { emitter } = app.value;
    emitter.emit(setLocaleOptionAction({ locale }));
    close();
  };

  /**
   * Moves through the rows and picks with Enter or Space, keeping from the
   * canvas those keys and every shortcut bar PANEL_PASSING_BINDINGS, and closes
   * on Escape. Any other press goes on to the host.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap } = app.value;
    const matches = (name: KeyBindingName) =>
      matchesShortcut(event, keyBindingMap[name]);

    if (isComposing(event)) {
      event.stopPropagation();
      return;
    }

    if (matches(KeyBindingName.stop)) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    const options = rows();
    const index = options.indexOf(event.target as HTMLButtonElement);
    if (index !== -1 && !hasModifier(event)) {
      const next = stepOption(index, options.length, event.key);
      if (next !== null) {
        event.preventDefault();
        event.stopPropagation();
        options[next].focus();
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        pick(OPTIONS[index]);
        return;
      }
    }

    if (
      !PANEL_PASSING_BINDINGS.some(matches) &&
      (hasMoveKeys(event.key) || KeyBindingNameList.some(matches))
    ) {
      event.stopPropagation();
    }
  };

  onMounted(() => {
    const { shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(handleStop),
      emitter.on({ openLocalePicker: handleToggle })
    );
  });

  const renderOption = (option: LocaleOption, content: DOMTemplateLiterals) => {
    const index = OPTIONS.indexOf(option);
    const checked = option === props.option;

    return (
      <button
        class={styles.option}
        type="button"
        role="option"
        aria-selected={String(checked)}
        data-locale={option}
        tabindex={index === state.active ? 0 : -1}
        on:click={() => pick(option)}
        on:focus={() => {
          state.active = index;
        }}
      >
        <span class={styles.check}>
          {checked ? <Icon name="check" size={14} /> : null}
        </span>
        {content}
      </button>
    );
  };

  return () => {
    if (!isOpen()) return null;

    const { t } = i18n.value;
    const system = localeInfoOf(props.systemLocale);

    return (
      <div class={['locale-picker', styles.root]} on:keydown={handleKeydown}>
        <div class={styles.title}>{t('common.displayLanguage')}</div>
        <div
          use:ref={ref(list)}
          class={styles.list}
          role="listbox"
          aria-label={t('common.displayLanguage')}
        >
          <div class={styles.pinned}>
            {renderOption(
              SYSTEM_LOCALE,
              <>
                <span class={styles.label}>{t('common.system')}</span>
                <span
                  class={styles.hint}
                  prop:lang={system.code}
                  prop:dir="auto"
                >
                  {system.label}
                </span>
              </>
            )}
            <Separator space={4} />
          </div>
          {LOCALES.map(({ code, label }) =>
            renderOption(
              code,
              <span class={styles.label} prop:lang={code}>
                {label}
              </span>
            )
          )}
        </div>
      </div>
    );
  };
};

export default LocalePicker;
