import { describe, expect, it, vi } from 'vite-plus/test';

import { Bridge } from '@/bridge';
import * as commands from '@/commands';
import {
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveLocaleCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
  webviewUpdateLocaleCommand,
  webviewUpdateReadonlyCommand,
  webviewUpdateThemeCommand,
} from '@/commands';

const allCommands = [
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveValueCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveLocaleCommand,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewUpdateThemeCommand,
  webviewUpdateLocaleCommand,
  webviewUpdateReadonlyCommand,
  webviewReplicationCommand,
];

describe('command definitions', () => {
  it('names each command after its exported identifier', () => {
    for (const [name, command] of Object.entries(commands)) {
      expect(command).toEqual({ type: name });
    }
  });

  it('exports exactly the thirteen known commands', () => {
    expect(Object.keys(commands).sort()).toEqual(
      [
        'hostExportFileCommand',
        'hostImportFileCommand',
        'hostInitialCommand',
        'hostSaveValueCommand',
        'hostSaveReplicationCommand',
        'hostSaveThemeCommand',
        'hostSaveLocaleCommand',
        'webviewImportFileCommand',
        'webviewInitialValueCommand',
        'webviewUpdateThemeCommand',
        'webviewUpdateLocaleCommand',
        'webviewUpdateReadonlyCommand',
        'webviewReplicationCommand',
      ].sort()
    );
  });

  it('gives every command a unique type', () => {
    const types = allCommands.map(command => command.type);

    expect(new Set(types).size).toBe(types.length);
  });

  it('splits the commands into a host and a webview namespace', () => {
    const names = Object.keys(commands);

    expect(names.filter(name => name.startsWith('host'))).toHaveLength(7);
    expect(names.filter(name => name.startsWith('webview'))).toHaveLength(6);
  });
});

describe('commands over a Bridge', () => {
  it('round-trips a host export file payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostExportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostExportFileCommand, {
        value: 'YmFzZTY0',
        fileName: 'schema.erd',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      value: 'YmFzZTY0',
      fileName: 'schema.erd',
    });
  });

  it('round-trips a host import file payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'sql',
        op: 'diff',
        accept: '.sql',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'sql',
      op: 'diff',
      accept: '.sql',
    });
  });

  it('round-trips a host import file payload for graphql', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'graphql',
        op: 'set',
        // accept is the browser input attribute the editor authors, so it
        // carries every extension the type answers to, not just the canonical
        // one.
        accept: '.graphql,.gql,.graphqls',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'graphql',
      op: 'set',
      accept: '.graphql,.gql,.graphqls',
    });
  });

  it('round-trips a host import file payload for dbml', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'dbml',
        op: 'set',
        accept: '.dbml',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'dbml',
      op: 'set',
      accept: '.dbml',
    });
  });

  it('round-trips a host import file payload for aml', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'aml',
        op: 'set',
        accept: '.aml',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'aml',
      op: 'set',
      accept: '.aml',
    });
  });

  it('round-trips the mode of a host import file payload, through JSON too', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostImportFileCommand, listener);
    const action = Bridge.executeCommand(hostImportFileCommand, {
      type: 'sql',
      op: 'set',
      accept: '.sql',
      mode: 'append',
    });

    bridge.executeAction(JSON.parse(JSON.stringify(action)));

    expect(listener).toHaveBeenCalledWith({
      type: 'sql',
      op: 'set',
      accept: '.sql',
      mode: 'append',
    });
  });

  it('round-trips the payload-less host initial command', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostInitialCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostInitialCommand, undefined as never)
    );

    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it('round-trips a host save theme payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostSaveThemeCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(hostSaveThemeCommand, {
        appearance: 'auto',
        grayColor: 'slate',
        accentColor: 'indigo',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      appearance: 'auto',
      grayColor: 'slate',
      accentColor: 'indigo',
    });
  });

  it('round-trips a partial webview theme update payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewUpdateThemeCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'dark' })
    );

    expect(listener).toHaveBeenCalledWith({ appearance: 'dark' });
  });

  it('round-trips the system appearance a host names beside auto', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewUpdateThemeCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewUpdateThemeCommand, {
        appearance: 'auto',
        systemAppearance: 'light',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      appearance: 'auto',
      systemAppearance: 'light',
    });
  });

  it('round-trips a host save locale payload through JSON', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(hostSaveLocaleCommand, listener);
    const auto = Bridge.executeCommand(hostSaveLocaleCommand, {
      locale: 'auto',
    });
    const named = Bridge.executeCommand(hostSaveLocaleCommand, {
      locale: 'ko-KR',
    });

    bridge.executeAction(JSON.parse(JSON.stringify(auto)));
    bridge.executeAction(JSON.parse(JSON.stringify(named)));

    expect(listener.mock.calls).toEqual([
      [{ locale: 'auto' }],
      [{ locale: 'ko-KR' }],
    ]);
  });

  it('round-trips a webview locale update with and without a system locale through JSON', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewUpdateLocaleCommand, listener);
    const auto = Bridge.executeCommand(webviewUpdateLocaleCommand, {
      locale: 'auto',
      systemLocale: 'pt-PT',
    });
    const named = Bridge.executeCommand(webviewUpdateLocaleCommand, {
      locale: 'ar-SA',
    });

    bridge.executeAction(JSON.parse(JSON.stringify(auto)));
    bridge.executeAction(JSON.parse(JSON.stringify(named)));

    expect(listener.mock.calls).toEqual([
      [{ locale: 'auto', systemLocale: 'pt-PT' }],
      [{ locale: 'ar-SA' }],
    ]);
  });

  it('keeps the locale save and locale update commands distinct', () => {
    const bridge = new Bridge();
    const save = vi.fn();
    const update = vi.fn();
    bridge.registerCommand(hostSaveLocaleCommand, save);
    bridge.registerCommand(webviewUpdateLocaleCommand, update);

    bridge.executeAction(
      Bridge.executeCommand(webviewUpdateLocaleCommand, { locale: 'en' })
    );

    expect(update).toHaveBeenCalledWith({ locale: 'en' });
    expect(save).not.toHaveBeenCalled();
  });

  it('round-trips a primitive readonly payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewUpdateReadonlyCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewUpdateReadonlyCommand, true)
    );
    bridge.executeAction(
      Bridge.executeCommand(webviewUpdateReadonlyCommand, false)
    );

    expect(listener.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps host and webview replication channels separate', () => {
    const bridge = new Bridge();
    const host = vi.fn();
    const webview = vi.fn();
    bridge.registerCommand(hostSaveReplicationCommand, host);
    bridge.registerCommand(webviewReplicationCommand, webview);

    bridge.executeAction(
      Bridge.executeCommand(webviewReplicationCommand, { actions: ['a'] })
    );

    expect(webview).toHaveBeenCalledWith({ actions: ['a'] });
    expect(host).not.toHaveBeenCalled();
  });

  it('keeps the save-value and initial-value commands distinct', () => {
    const bridge = new Bridge();
    const save = vi.fn();
    const initial = vi.fn();
    bridge.registerCommand(hostSaveValueCommand, save);
    bridge.registerCommand(webviewInitialValueCommand, initial);

    bridge.executeAction(
      Bridge.executeCommand(hostSaveValueCommand, {
        value: '{}',
        changed: false,
        runtimeValue: '{}',
      })
    );

    expect(save).toHaveBeenCalledWith({
      value: '{}',
      changed: false,
      runtimeValue: '{}',
    });
    expect(initial).not.toHaveBeenCalled();
  });

  it('round-trips the runtime value beside the value to save through JSON', () => {
    const bridge = new Bridge();
    const save = vi.fn();
    bridge.registerCommand(hostSaveValueCommand, save);
    const action = Bridge.executeCommand(hostSaveValueCommand, {
      value: '{"doc":"saved"}',
      changed: true,
      runtimeValue: '{"doc":"held"}',
    });

    bridge.executeAction(JSON.parse(JSON.stringify(action)));

    expect(save).toHaveBeenCalledWith({
      value: '{"doc":"saved"}',
      changed: true,
      runtimeValue: '{"doc":"held"}',
    });
  });

  it('round-trips a webview import file payload', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewImportFileCommand, {
        type: 'json',
        op: 'set',
        value: '{"version":3}',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'json',
      op: 'set',
      value: '{"version":3}',
    });
  });

  it('round-trips a webview import file payload for graphql', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewImportFileCommand, {
        type: 'graphql',
        op: 'set',
        value: 'type User { id: ID! }',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'graphql',
      op: 'set',
      value: 'type User { id: ID! }',
    });
  });

  it('round-trips a webview import file payload for dbml', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewImportFileCommand, {
        type: 'dbml',
        op: 'set',
        value: 'Table users { id int [pk] }',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'dbml',
      op: 'set',
      value: 'Table users { id int [pk] }',
    });
  });

  it('round-trips a webview import file payload for aml', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewImportFileCommand, listener);

    bridge.executeAction(
      Bridge.executeCommand(webviewImportFileCommand, {
        type: 'aml',
        op: 'set',
        value: 'users\n  id int pk',
      })
    );

    expect(listener).toHaveBeenCalledWith({
      type: 'aml',
      op: 'set',
      value: 'users\n  id int pk',
    });
  });

  it('round-trips the mode of a webview import file payload, through JSON too', () => {
    const bridge = new Bridge();
    const listener = vi.fn();
    bridge.registerCommand(webviewImportFileCommand, listener);
    const action = Bridge.executeCommand(webviewImportFileCommand, {
      type: 'json',
      op: 'set',
      value: '{}',
      mode: 'append',
    });

    bridge.executeAction(JSON.parse(JSON.stringify(action)));

    expect(listener).toHaveBeenCalledWith({
      type: 'json',
      op: 'set',
      value: '{}',
      mode: 'append',
    });
  });
});
