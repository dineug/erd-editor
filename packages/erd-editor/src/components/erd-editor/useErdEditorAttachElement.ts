import { toJson } from '@dineug/erd-editor-schema';
import { observable, onMounted, Ref, watch } from '@dineug/r-html';
import { arrayHas, isArray, isString } from '@dineug/shared';
import { get, isEmpty, omit } from 'lodash-es';

import { AppContext } from '@/components/appContext';
import { clearAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnmounted } from '@/hooks/useUnmounted';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceList,
  createTheme,
  GrayColor,
  GrayColorList,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { Theme, ThemeTokens } from '@/themes/tokens';
import { KeyBindingName, KeyBindingNameList } from '@/utils/keyboard-shortcut';
import { toSafeString } from '@/utils/validation';

import { ErdEditorElement, ErdEditorProps } from './ErdEditor';

const ExternalKeyBindingNameList = omit(KeyBindingNameList, [
  KeyBindingName.edit,
  KeyBindingName.stop,
  KeyBindingName.find,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
]) as string[];

const defaultThemeOptions: ThemeOptions = {
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.dark,
} as const;

const hasGrayColor = arrayHas<string>(GrayColorList);
const hasAccentColor = arrayHas<string>(AccentColorList);
const hasAppearance = arrayHas<string>(AppearanceList);

type Props = {
  props: ErdEditorProps;
  ctx: ErdEditorElement;
  app: AppContext;
  root: Ref<HTMLDivElement>;
};

export function useErdEditorAttachElement({
  props,
  ctx,
  app: { store, keyBindingMap },
  root,
}: Props) {
  const themeState = observable<{
    options: ThemeOptions;
    preset: Theme;
    custom: Partial<Theme>;
  }>({
    options: { ...defaultThemeOptions },
    preset: createTheme(defaultThemeOptions),
    custom: {},
  });

  const theme = observable<Theme>(
    {
      ...themeState.preset,
      ...themeState.custom,
    },
    { shallow: true }
  );

  const darkMode = useDarkMode();
  const { addUnsubscribe } = useUnmounted();

  const emitChange = () => {
    ctx.dispatchEvent(new CustomEvent('change'));
  };

  onMounted(() => {
    addUnsubscribe(
      store.change$.subscribe(emitChange),
      watch(props).subscribe(propName => {
        if (propName !== 'systemDarkMode' || !props.systemDarkMode) {
          return;
        }

        themeState.options.appearance = darkMode.state.isDark
          ? Appearance.dark
          : Appearance.light;
      }),
      watch(darkMode.state).subscribe(propName => {
        if (propName !== 'isDark' || !props.systemDarkMode) {
          return;
        }

        themeState.options.appearance = darkMode.state.isDark
          ? Appearance.dark
          : Appearance.light;
      }),
      watch(themeState.options).subscribe(() => {
        Object.assign(themeState.preset, createTheme(themeState.options));
      }),
      watch(themeState.preset).subscribe(() => {
        Object.assign(theme, themeState.preset, themeState.custom);
      }),
      watch(themeState).subscribe(propName => {
        if (propName !== 'custom') return;

        Object.assign(theme, themeState.preset, themeState.custom);
      })
    );
  });

  ctx.focus = () => {
    root.value?.focus();
  };

  ctx.blur = () => {
    ctx.focus();
    root.value?.blur();
  };

  ctx.clear = () => {
    store.dispatch(clearAction());
  };

  ctx.setInitialValue = value => {
    const safeValue = toSafeString(value);
    store.dispatch(
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
  };

  ctx.setPresetTheme = newThemeOptions => {
    if (
      isString(newThemeOptions.grayColor) &&
      hasGrayColor(newThemeOptions.grayColor)
    ) {
      themeState.options.grayColor = newThemeOptions.grayColor;
    }
    if (
      isString(newThemeOptions.accentColor) &&
      hasAccentColor(newThemeOptions.accentColor)
    ) {
      themeState.options.accentColor = newThemeOptions.accentColor;
    }
    if (
      isString(newThemeOptions.appearance) &&
      hasAppearance(newThemeOptions.appearance)
    ) {
      themeState.options.appearance = newThemeOptions.appearance;
    }
  };

  ctx.setTheme = newTheme => {
    const customTheme: Partial<Theme> = {};
    ThemeTokens.forEach(key => {
      const value = get(newTheme, key);
      isString(value) && Reflect.set(customTheme, key, value);
    });
    themeState.custom = customTheme;
  };

  ctx.setKeyBindingMap = newKeyBindingMap => {
    ExternalKeyBindingNameList.forEach(key => {
      const value = get(newKeyBindingMap, key);
      isArray(value) && Reflect.set(keyBindingMap, key, value);
    });
  };

  ctx.setSchemaSQL = value => {
    const safeValue = toSafeString(value);
    if (isEmpty(safeValue)) return;

    // TODO: DDLParser
    // const statements = schemaSQLParser(value);
    // const json = createJson(statements, helper, store.canvasState.database);
    // store.dispatch(loadJson$(json), sortTable());
  };

  ctx.getSchemaSQL = databaseVendor => {
    // TODO: createSchemaSQL
    // createSchemaSQL(store);
    return '';
  };

  Object.defineProperty(ctx, 'value', {
    get: () => toJson(store.state),
    set: (value: string) => ctx.setInitialValue(value),
  });

  return {
    theme,
    isDarkMode: () => themeState.options.appearance === Appearance.dark,
  };
}
