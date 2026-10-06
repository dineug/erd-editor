import {
  AccentColor,
  GrayColor,
  LocaleLabel,
  type LocaleSetting,
  ThemeOptions,
} from '@dineug/erd-editor-webview-bridge';
import * as vscode from 'vscode';

const SECTION = 'dineug.erd-editor';
const LOCALE_KEY = 'locale';

export const LOCALE_SETTING = `${SECTION}.${LOCALE_KEY}`;

function getConfigurationScope(
  config: vscode.WorkspaceConfiguration,
  key: string
) {
  const inspect = config.inspect(key);
  // Presence, not truthiness: a setting deliberately stored as false, 0 or
  // '' at a narrower scope is still set, and redirecting its write to Global
  // would leave the narrower value in place and silently win over it.
  if (inspect?.workspaceFolderValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }
  if (inspect?.workspaceValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

export function saveTheme(theme: ThemeOptions) {
  const config = vscode.workspace.getConfiguration('dineug.erd-editor.theme');

  config.update(
    'appearance',
    theme.appearance,
    getConfigurationScope(config, 'appearance')
  );
  config.update(
    'grayColor',
    theme.grayColor,
    getConfigurationScope(config, 'grayColor')
  );
  config.update(
    'accentColor',
    theme.accentColor,
    getConfigurationScope(config, 'accentColor')
  );
}

export function getTheme(): ThemeOptions {
  const config = vscode.workspace.getConfiguration('dineug.erd-editor.theme');

  return {
    appearance: config.get<ThemeOptions['appearance']>('appearance', 'auto'),
    grayColor: config.get('grayColor', GrayColor.slate),
    accentColor: config.get('accentColor', AccentColor.indigo),
  };
}

/** The display language setting; a value settings.json holds that names no language reads as auto. */
export function getLocale(): LocaleSetting {
  const locale = vscode.workspace
    .getConfiguration(SECTION)
    .get<unknown>(LOCALE_KEY, 'auto');

  return typeof locale === 'string' && Object.hasOwn(LocaleLabel, locale)
    ? (locale as LocaleSetting)
    : 'auto';
}

export function saveLocale(locale: LocaleSetting) {
  const config = vscode.workspace.getConfiguration(SECTION);

  config.update(LOCALE_KEY, locale, getConfigurationScope(config, LOCALE_KEY));
}
