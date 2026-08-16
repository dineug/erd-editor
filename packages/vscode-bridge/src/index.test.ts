import { describe, expect, it, vi } from 'vite-plus/test';

import * as bridgeModule from '@/bridge';
import * as commandsModule from '@/commands';
import * as publicApi from '@/index';
import * as themeModule from '@/theme';

describe('public api surface', () => {
  it('re-exports the bridge runtime values by identity', () => {
    expect(publicApi.Bridge).toBe(bridgeModule.Bridge);
    expect(publicApi.createCommand).toBe(bridgeModule.createCommand);
  });

  it('re-exports every command by identity', () => {
    for (const [name, command] of Object.entries(commandsModule)) {
      expect(publicApi[name as keyof typeof publicApi]).toBe(command);
    }
  });

  it('re-exports the theme enums by identity', () => {
    expect(publicApi.Appearance).toBe(themeModule.Appearance);
    expect(publicApi.GrayColor).toBe(themeModule.GrayColor);
    expect(publicApi.AccentColor).toBe(themeModule.AccentColor);
  });

  it('exports exactly the runtime members of the barrel', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'Bridge',
        'createCommand',
        'Appearance',
        'GrayColor',
        'AccentColor',
        ...Object.keys(commandsModule),
      ].sort()
    );
  });

  it('does not leak internal helpers such as isAction', () => {
    expect(publicApi).not.toHaveProperty('isAction');
  });

  it('is usable end to end through the barrel alone', () => {
    const { Bridge, createCommand } = publicApi;
    const bridge = new Bridge();
    const command = createCommand<{ n: number }>('barrel');
    const listener = vi.fn();

    const dispose = bridge.registerCommand(command, listener);
    bridge.executeAction(Bridge.executeCommand(command, { n: 1 }));
    dispose();
    bridge.executeAction(Bridge.executeCommand(command, { n: 2 }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ n: 1 });
  });
});
