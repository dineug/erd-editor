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
  setGetShikiServiceCallback: vi.fn(),
  setImportFileCallback: vi.fn(),
  createReplicationStoreWorker: vi.fn(),
  getShikiService: vi.fn(),
}));

vi.mock('@dineug/erd-editor', () => ({
  setExportFileCallback: mocks.setExportFileCallback,
  setGetShikiServiceCallback: mocks.setGetShikiServiceCallback,
  setImportFileCallback: mocks.setImportFileCallback,
}));

vi.mock('@dineug/erd-editor-replication-store-worker', () => ({
  createReplicationStoreWorker: mocks.createReplicationStoreWorker,
}));

vi.mock('@dineug/erd-editor-shiki-worker', () => ({
  getShikiService: mocks.getShikiService,
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
    setPresetTheme: vi.fn(),
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

  it('routes every import type the bridge names to the editor method for it', () => {
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
    expect(editor.element.setSchemaSQL).toHaveBeenCalledWith(
      'CREATE TABLE t ();'
    );
    expect(editor.element.setSchemaGraphQL).toHaveBeenCalledWith(
      'type T { id: ID }'
    );
    expect(editor.element.setSchemaDBML).toHaveBeenCalledWith('Table t {}');
    expect(editor.element.setSchemaAML).toHaveBeenCalledWith('t\n  id uuid pk');
  });

  it('resolves an auto appearance through the host and refreshes only while it stays auto', () => {
    const resolveAppearance = vi.fn(() => 'light' as const);
    const client = mount({ resolveAppearance });

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'auto' })
    );
    client.refreshAppearance();
    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, { appearance: 'dark' })
    );
    client.refreshAppearance();

    expect(editor.element.setPresetTheme.mock.calls).toEqual([
      [{ appearance: 'light' }],
      [{ appearance: 'light' }],
      [{ appearance: 'dark' }],
    ]);
    expect(resolveAppearance).toHaveBeenCalledTimes(2);
  });

  it('means dark by auto where the host does not say', () => {
    mount();

    fromHost(
      Bridge.executeCommand(webviewUpdateThemeCommand, {
        appearance: 'auto',
        grayColor: 'slate',
      })
    );

    expect(editor.element.setPresetTheme).toHaveBeenCalledWith({
      appearance: 'dark',
      grayColor: 'slate',
    });
  });

  it('saves a theme the editor changed and follows its appearance from then on', () => {
    const resolveAppearance = vi.fn(() => 'light' as const);
    const client = mount({ resolveAppearance });
    fromHost(
      Bridge.executeCommand(webviewInitialValueCommand, { value: '{}' })
    );
    const detail = {
      appearance: 'auto',
      grayColor: 'gray',
      accentColor: 'blue',
    };

    editor.element.dispatchEvent(
      new CustomEvent('changePresetTheme', { detail })
    );
    client.refreshAppearance();

    expect(dispatch).toHaveBeenCalledWith(
      Bridge.executeCommand(hostSaveThemeCommand, detail as never)
    );
    expect(editor.element.setPresetTheme).toHaveBeenCalledWith({
      appearance: 'light',
    });
  });

  it('toggles readonly', () => {
    mount();

    fromHost(Bridge.executeCommand(webviewUpdateReadonlyCommand, true));

    expect(editor.element.readonly).toBe(true);
  });

  it('relays the value the replica saved to the host', () => {
    mount();
    const saved = Bridge.executeCommand(hostSaveValueCommand, { value: '{}' });

    worker.listeners[0](new MessageEvent('message', { data: saved }));

    expect(dispatch).toHaveBeenCalledWith(saved);
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
