import * as vscode from 'vscode';

const SECTION = 'dineug.erd-editor.agentHub';

export const AGENT_HUB_ENABLED_SETTING = `${SECTION}.enabled`;

/**
 * The hub listens only in a trusted window with the setting on. Otherwise the
 * window still writes a hub false lock, which keeps headless writes off its paths.
 */
export function isHubEnabled(): boolean {
  return (
    vscode.workspace.isTrusted &&
    vscode.workspace.getConfiguration(SECTION).get<boolean>('enabled', true) !==
      false
  );
}

export function affectsHubEnabled(
  event: vscode.ConfigurationChangeEvent
): boolean {
  return event.affectsConfiguration(AGENT_HUB_ENABLED_SETTING);
}
