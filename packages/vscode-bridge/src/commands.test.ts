import { describe, expect, it, vi } from 'vite-plus/test';

import { Bridge } from '@/bridge';
import * as commands from '@/commands';
import {
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
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
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewUpdateThemeCommand,
  webviewUpdateReadonlyCommand,
  webviewReplicationCommand,
];

describe('command definitions', () => {
  it('names each command after its exported identifier', () => {
    for (const [name, command] of Object.entries(commands)) {
      expect(command).toEqual({ type: name });
    }
  });

  it('exports exactly the eleven known commands', () => {
    expect(Object.keys(commands).sort()).toEqual(
      [
        'hostExportFileCommand',
        'hostImportFileCommand',
        'hostInitialCommand',
        'hostSaveValueCommand',
        'hostSaveReplicationCommand',
        'hostSaveThemeCommand',
        'webviewImportFileCommand',
        'webviewInitialValueCommand',
        'webviewUpdateThemeCommand',
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

    expect(names.filter(name => name.startsWith('host'))).toHaveLength(6);
    expect(names.filter(name => name.startsWith('webview'))).toHaveLength(5);
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
      Bridge.executeCommand(hostSaveValueCommand, { value: '{}' })
    );

    expect(save).toHaveBeenCalledWith({ value: '{}' });
    expect(initial).not.toHaveBeenCalled();
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
});
