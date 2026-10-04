import {
  type AnyAction,
  Bridge,
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
} from '@dineug/erd-editor-webview-bridge';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { mountWebview, type WebviewClient } from './mountWebview';

const mocks = vi.hoisted(() => ({
  setExportFileCallback: vi.fn(),
  setImportFileCallback: vi.fn(),
  createReplicationStoreWorker: vi.fn(),
}));

vi.mock('@dineug/erd-editor', () => ({
  setExportFileCallback: mocks.setExportFileCallback,
  setImportFileCallback: mocks.setImportFileCallback,
}));

vi.mock('@dineug/erd-editor-replication-store-worker', () => ({
  createReplicationStoreWorker: mocks.createReplicationStoreWorker,
}));

const createElement = document.createElement.bind(document);

/** The element the host page gets: a real node carrying the editor's API as spies. */
function fakeEditor() {
  const subscribers: Array<(actions: unknown[]) => void> = [];
  const sharedStore = {
    subscribe: (listener: (actions: unknown[]) => void) => {
      subscribers.push(listener);
      return () => {};
    },
    dispatch: vi.fn(),
  };
  const element = Object.assign(createElement('erd-editor'), {
    value: '',
    readonly: false,
    enableThemeBuilder: false,
    setInitialValue: vi.fn(),
    setDiffValue: vi.fn(),
    setSchemaSQL: vi.fn(),
    setSchemaGraphQL: vi.fn(),
    setSchemaDBML: vi.fn(),
    setSchemaAML: vi.fn(),
    setSchemaJSON: vi.fn(),
    setPresetTheme: vi.fn(),
    setSystemAppearance: vi.fn(),
    getSharedStore: () => sharedStore,
  });

  return { element, sharedStore, subscribers };
}

function fakeWorker() {
  const listeners: Array<(event: MessageEvent) => void> = [];
  return {
    worker: {
      postMessage: vi.fn(),
      addEventListener: (
        _: string,
        listener: (event: MessageEvent) => void
      ) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    } as unknown as Worker,
    listeners,
  };
}

const fromHost = (action: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { data: action }));

let editor: ReturnType<typeof fakeEditor>;
let worker: ReturnType<typeof fakeWorker>;
let dispatch: ReturnType<typeof vi.fn<(action: AnyAction) => void>>;
let client: WebviewClient | null;

const mount = (options: Partial<Parameters<typeof mountWebview>[0]> = {}) => {
  client = mountWebview({
    dispatch,
    workerName: 'test/replication-store-worker',
    ...options,
  });
  return client;
};

beforeEach(() => {
  editor = fakeEditor();
  worker = fakeWorker();
  dispatch = vi.fn<(action: AnyAction) => void>();
  client = null;
  mocks.setExportFileCallback.mockReset();
  mocks.setImportFileCallback.mockReset();
  mocks.createReplicationStoreWorker.mockReset().mockReturnValue(worker.worker);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'erd-editor' ? editor.element : createElement(tag)
  );
});

afterEach(() => {
  client?.dispose();
  editor.element.remove();
  vi.restoreAllMocks();
});

describe('mountWebview', () => {
  it('announces itself to the host and names the worker the host chose', () => {
    mount();

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostInitialCommand, undefined)
    );
    expect(mocks.createReplicationStoreWorker).toHaveBeenCalledWith({
      name: 'test/replication-store-worker',
    });
    expect(document.body.contains(editor.element)).toBe(false);
  });

  it('mounts the editor and seeds the replica when the host sends the value', () => {
    const onMounted = vi.fn();
    mount({ onMounted });

    fromHost(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );

    expect(editor.element.setInitialValue).toHaveBeenCalledWith('{}');
    expect(editor.element.enableThemeBuilder).toBe(true);
    expect(worker.worker.postMessage).toHaveBeenCalledWith(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );
    expect(document.body.contains(editor.element)).toBe(true);
    expect(onMounted).toHaveBeenCalledTimes(1);
  });

  it('sends what the editor changes to the replica and to the host', () => {
    mount();
    fromHost(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );
    const actions = [{ type: 'table.add' }];

    editor.subscribers[0](actions);

    expect(worker.worker.postMessage).toHaveBeenCalledWith(
      Bridge.executeCommand(webviewReplicationCommand, { actions })
    );
    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostSaveReplicationCommand, { actions })
    );
  });

  it('applies what the host replicates to the store and the replica alike', () => {
    mount();
    const actions = [{ type: 'table.remove' }];

    fromHost(Bridge.executeCommand(webviewReplicationCommand, { actions }));

    expect(editor.sharedStore.dispatch).toHaveBeenCalledWith(actions);
    expect(worker.worker.postMessage).toHaveBeenCalledWith(
      Bridge.executeCommand(webviewReplicationCommand, { actions })
    );
  });

  it('routes every import type the bridge names to the editor method for it, placing the schemas', () => {
    mount();
    const send = (type: string, op: string, value: string) =>
      fromHost(
        Bridge.executeCommand(webviewImportFileCommand, {
          type,
          op,
          value,
        } as never)
      );

    send('json', 'set', '{"a":1}');
    send('json', 'diff', '{"b":2}');
    send('sql', 'set', 'CREATE TABLE t ();');
    send('graphql', 'set', 'type T { id: ID }');
    send('dbml', 'set', 'Table t {}');
    send('aml', 'set', 't\n  id uuid pk');

    expect(editor.element.value).toBe('{"a":1}');
    expect(editor.element.setDiffValue).toHaveBeenCalledWith('{"b":2}');
    const placed = { placement: 'auto' };
    expect(editor.element.setSchemaSQL).toHaveBeenCalledWith(
      'CREATE TABLE t ();',
      placed
    );
    expect(editor.element.setSchemaGraphQL).toHaveBeenCalledWith(
      'type T { id: ID }',
      placed
    );
    expect(editor.element.setSchemaDBML).toHaveBeenCalledWith(
      'Table t {}',
      placed
    );
    expect(editor.element.setSchemaAML).toHaveBeenCalledWith(
      't\n  id uuid pk',
      placed
    );
  });

  it('hands an append to every setter with its mode, placing the schemas', () => {
    mount();
    const send = (type: string, value: string, mode?: string) =>
      fromHost(
        Bridge.executeCommand(webviewImportFileCommand, {
          type,
          op: 'set',
          value,
          mode,
        } as never)
      );

    send('json', '{"a":1}', 'append');
    send('sql', 'CREATE TABLE t ();', 'append');
    send('graphql', 'type T { id: ID }', 'append');
    send('dbml', 'Table t {}', 'append');
    send('aml', 't\n  id uuid pk', 'append');
    send('sql', 'CREATE TABLE r ();', 'replace');

    const added = { placement: 'auto', mode: 'append' };
    expect(editor.element.value).toBe('');
    expect(editor.element.setSchemaJSON).toHaveBeenCalledExactlyOnceWith(
      '{"a":1}',
      { mode: 'append' }
    );
    expect(editor.element.setSchemaSQL.mock.calls).toEqual([
      ['CREATE TABLE t ();', added],
      ['CREATE TABLE r ();', { placement: 'auto' }],
    ]);
    expect(editor.element.setSchemaGraphQL).toHaveBeenCalledWith(
      'type T { id: ID }',
      added
    );
    expect(editor.element.setSchemaDBML).toHaveBeenCalledWith(
      'Table t {}',
      added
    );
    expect(editor.element.setSchemaAML).toHaveBeenCalledWith(
      't\n  id uuid pk',
      added
    );
  });

  it('asks the host for a file with the mode the editor names', () => {
    mount({ importFile: true });
    const [callback] = mocks.setImportFileCallback.mock.calls[0];

    callback({
      type: 'sql',
      op: 'set',
      accept: '.sql',
      mode: 'append',
    });

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'sql',
        op: 'set',
        accept: '.sql',
        mode: 'append',
      })
    );
  });

  it('tells the editor what system shows as it mounts', () => {
    mount({ resolveAppearance: () => 'light' });

    expect(editor.element.setSystemAppearance).toHaveBeenCalledWith('light');
  });

  it('hands auto to the editor as system, shown as the host resolves it', () => {
    const resolveAppearance = vi.fn(() => 'light' as const);
    mount({ resolveAppearance });

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'auto' })
    );

    expect(editor.element.setPresetTheme).toHaveBeenLastCalledWith({
      appearance: 'system',
    });
    expect(editor.element.setSystemAppearance).toHaveBeenLastCalledWith(
      'light'
    );
  });

  it('passes a light or dark appearance through as it is', () => {
    mount();

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'light' })
    );
    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { accentColor: 'jade' })
    );

    expect(editor.element.setPresetTheme.mock.calls).toEqual([
      [{ appearance: 'light' }],
      [{ accentColor: 'jade', appearance: undefined }],
    ]);
  });

  it('refreshes what system shows whichever appearance is picked', () => {
    const resolveAppearance = vi.fn(() => 'light' as const);
    const client = mount({ resolveAppearance });
    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'dark' })
    );

    resolveAppearance.mockReturnValue('dark' as never);
    client.refreshAppearance();

    expect(editor.element.setSystemAppearance).toHaveBeenLastCalledWith('dark');
    expect(editor.element.setPresetTheme).toHaveBeenCalledTimes(1);
  });

  it('means dark by auto where the host does not say', () => {
    mount();

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, {
        appearance: 'auto',
        grayColor: 'slate',
      })
    );

    expect(editor.element.setSystemAppearance).toHaveBeenLastCalledWith('dark');
    expect(editor.element.setPresetTheme).toHaveBeenCalledWith({
      appearance: 'system',
      grayColor: 'slate',
    });
  });

  it('takes what auto shows from a theme update that names it', () => {
    const resolveAppearance = vi.fn(() => 'dark' as const);
    mount({ resolveAppearance });
    resolveAppearance.mockClear();

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, {
        appearance: 'auto',
        systemAppearance: 'light',
      })
    );

    expect(resolveAppearance).not.toHaveBeenCalled();
    expect(editor.element.setSystemAppearance).toHaveBeenLastCalledWith(
      'light'
    );
    expect(editor.element.setPresetTheme.mock.calls[0][0]).toEqual({
      appearance: 'system',
    });
  });

  it('keeps what a theme update named for auto through a refresh', () => {
    const resolveAppearance = vi.fn(() => 'dark' as const);
    const client = mount({ resolveAppearance });
    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, {
        appearance: 'auto',
        systemAppearance: 'light',
      })
    );

    client.refreshAppearance();
    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { accentColor: 'jade' })
    );

    expect(editor.element.setSystemAppearance.mock.calls.slice(1)).toEqual([
      ['light'],
      ['light'],
      ['light'],
    ]);
  });

  it('saves a system pick of the theme builder as auto', () => {
    mount();
    fromHost(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );

    editor.element.dispatchEvent(
      new CustomEvent('changePresetTheme', {
        detail: {
          appearance: 'system',
          grayColor: 'gray',
          accentColor: 'blue',
        },
      })
    );

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostSaveThemeCommand, {
        appearance: 'auto',
        grayColor: 'gray',
        accentColor: 'blue',
      })
    );
  });

  it('saves a light or dark pick of the theme builder as it is', () => {
    mount();
    fromHost(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );
    const detail = {
      appearance: 'light',
      grayColor: 'gray',
      accentColor: 'blue',
    } as const;

    editor.element.dispatchEvent(
      new CustomEvent('changePresetTheme', { detail })
    );

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostSaveThemeCommand, detail)
    );
  });

  it('toggles readonly', () => {
    mount();

    fromHost(Bridge.executeCommand(webviewUpdateReadonlyCommand, true));

    expect(editor.element.readonly).toBe(true);
  });

  it('relays the value the replica saved to the host, whether it changed or not', () => {
    mount();

    for (const changed of [true, false]) {
      const saved = Bridge.executeCommand(hostSaveValueCommand, {
        value: '{}',
        changed,
      });
      worker.listeners[0](new MessageEvent('message', { data: saved }));

      expect(dispatch).toHaveBeenLastCalledWith(saved);
    }
  });

  it('hands file dialogs to the host only when asked', () => {
    mount();
    expect(mocks.setImportFileCallback).not.toHaveBeenCalled();
    client!.dispose();

    mount({ importFile: true });
    const [callback] = mocks.setImportFileCallback.mock.calls[0];
    callback({ type: 'json', op: 'set', accept: '.json' });

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'json',
        op: 'set',
        accept: '.json',
      })
    );
  });

  it('exports a file to the host as base64', async () => {
    mount();
    const [callback] = mocks.setExportFileCallback.mock.calls[0];

    await callback(new Blob(['erd']), { fileName: 'schema.sql' });

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostExportFileCommand, {
        value: 'ZXJk',
        fileName: 'schema.sql',
      })
    );
  });

  it('stops listening once disposed', () => {
    const client = mount();

    client.dispose();
    fromHost(Bridge.executeCommand(webviewUpdateReadonlyCommand, true));

    expect(editor.element.readonly).toBe(false);
    expect(worker.worker.terminate).toHaveBeenCalledTimes(1);
  });
});
