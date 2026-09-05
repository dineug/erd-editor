import {
  type ErdEditorElement,
  setExportFileCallback,
  setGetShikiServiceCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';
import { createReplicationStoreWorker } from '@dineug/erd-editor-replication-store-worker';
import {
  type AnyAction,
  Appearance,
  Bridge,
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
  type ThemeOptions,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
  webviewUpdateReadonlyCommand,
  webviewUpdateThemeCommand,
} from '@dineug/erd-editor-webview-bridge';

import { encodeBase64 } from './base64';

/** What differs between the IDE hosts; what the protocol itself decides stays in mountWebview. */
export interface WebviewHost {
  /** Sends one action to the host over whatever transport it has. */
  dispatch: (action: AnyAction) => void;
  /** The replica worker's name, one per host, so two IDEs never share a worker. */
  workerName: string;
  /** What an auto appearance means on this host. Left out, it means dark. */
  resolveAppearance?: () => Appearance;
  /** True hands file dialogs to the host; false keeps the editor's own file input. */
  importFile?: boolean;
  /** Runs once the editor is in the document, where a host clears its placeholder. */
  onMounted?: () => void;
}

export interface WebviewClient {
  editor: ErdEditorElement;
  /** Re-applies the appearance while the theme is auto, for a host whose system theme moved. */
  refreshAppearance: () => void;
  /** Drops the listeners and the worker, for a page that mounts more than once. */
  dispose: () => void;
}

/**
 * Mounts the editor into a webview and wires the whole host protocol: the
 * bridge commands both ways, the replica worker, file export and the lazy
 * highlighter. The editor joins the document once the host sends its value.
 */
export function mountWebview(host: WebviewHost): WebviewClient {
  const bridge = new Bridge();
  const workerBridge = new Bridge();
  const editor = document.createElement('erd-editor');
  const sharedStore = editor.getSharedStore({
    mouseTracker: false,
    focusTracker: false,
  });
  const replicationStoreWorker = createReplicationStoreWorker({
    name: host.workerName,
  });
  const resolveAppearance =
    host.resolveAppearance ?? ((): Appearance => Appearance.dark);

  let appearance: ThemeOptions['appearance'] = Appearance.dark;

  const dispatch = (action: AnyAction) => {
    host.dispatch(action);
  };

  const dispatchWorker = (action: AnyAction) => {
    replicationStoreWorker.postMessage(action);
  };

  import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
    setGetShikiServiceCallback(getShikiService);
  });
  if (host.importFile) {
    setImportFileCallback(options => {
      dispatch(Bridge.executeCommand(hostImportFileCommand, options));
    });
  }
  setExportFileCallback(async (blob, options) => {
    const arrayBuffer = await blob.arrayBuffer();
    dispatch(
      Bridge.executeCommand(hostExportFileCommand, {
        value: encodeBase64(arrayBuffer),
        fileName: options.fileName,
      })
    );
  });

  const handleChangePresetTheme = (event: Event) => {
    const e = event as CustomEvent<ThemeOptions>;
    dispatch(Bridge.executeCommand(hostSaveThemeCommand, e.detail));
    appearance = e.detail.appearance;
  };

  const disposeCommands = Bridge.mergeRegister(
    bridge.registerCommand(webviewImportFileCommand, ({ type, op, value }) => {
      switch (type) {
        case 'json':
          op === 'set' ? (editor.value = value) : editor.setDiffValue(value);
          break;
        case 'sql':
          op === 'set' && editor.setSchemaSQL(value);
          break;
        case 'graphql':
          op === 'set' && editor.setSchemaGraphQL(value);
          break;
        case 'dbml':
          op === 'set' && editor.setSchemaDBML(value);
          break;
        case 'aml':
          op === 'set' && editor.setSchemaAML(value);
          break;
        default: {
          // The host has already read the file by the time we get here, so an
          // unhandled type is a silent loss. type is never in this arm, so
          // widening the bridge union without adding a case breaks the build.
          const unhandled: never = type;
          throw new Error(`unsupported import file type "${unhandled}"`);
        }
      }
    }),
    bridge.registerCommand(webviewInitialValueCommand, ({ value }) => {
      dispatchWorker(
        Bridge.executeCommand(webviewInitialValueCommand, { value })
      );

      editor.addEventListener('changePresetTheme', handleChangePresetTheme);
      editor.setInitialValue(value);
      editor.enableThemeBuilder = true;
      sharedStore.subscribe(actions => {
        dispatchWorker(
          Bridge.executeCommand(webviewReplicationCommand, { actions })
        );
        dispatch(
          Bridge.executeCommand(hostSaveReplicationCommand, { actions })
        );
      });
      document.body.appendChild(editor);
      host.onMounted?.();
    }),
    bridge.registerCommand(webviewReplicationCommand, ({ actions }) => {
      sharedStore.dispatch(actions);
      dispatchWorker(
        Bridge.executeCommand(webviewReplicationCommand, { actions })
      );
    }),
    bridge.registerCommand(webviewUpdateThemeCommand, payload => {
      if (payload.appearance) {
        appearance = payload.appearance;
      }

      editor.setPresetTheme({
        ...payload,
        appearance:
          payload.appearance === 'auto'
            ? resolveAppearance()
            : payload.appearance,
      });
    }),
    bridge.registerCommand(webviewUpdateReadonlyCommand, readonly => {
      editor.readonly = readonly;
    }),
    workerBridge.registerCommand(hostSaveValueCommand, ({ value }) => {
      dispatch(Bridge.executeCommand(hostSaveValueCommand, { value }));
    })
  );

  const handleHostMessage = (event: MessageEvent) => {
    bridge.executeAction(event.data);
  };
  const handleWorkerMessage = (event: MessageEvent) => {
    workerBridge.executeAction(event.data);
  };

  window.addEventListener('message', handleHostMessage);
  replicationStoreWorker.addEventListener('message', handleWorkerMessage);
  dispatch(Bridge.executeCommand(hostInitialCommand, undefined));

  return {
    editor,
    refreshAppearance: () => {
      if (appearance !== 'auto') return;
      editor.setPresetTheme({ appearance: resolveAppearance() });
    },
    dispose: () => {
      disposeCommands();
      window.removeEventListener('message', handleHostMessage);
      replicationStoreWorker.removeEventListener(
        'message',
        handleWorkerMessage
      );
      replicationStoreWorker.terminate();
      editor.removeEventListener('changePresetTheme', handleChangePresetTheme);
    },
  };
}
