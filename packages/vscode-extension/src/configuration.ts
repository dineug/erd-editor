import {
  AccentColor,
  Appearance,
  GrayColor,
  ThemeOptions,
} from '@dineug/erd-editor-vscode-bridge';
import * as vscode from 'vscode';

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
    appearance: config.get('appearance', Appearance.dark),
    grayColor: config.get('grayColor', GrayColor.slate),
    accentColor: config.get('accentColor', AccentColor.indigo),
  };
}
