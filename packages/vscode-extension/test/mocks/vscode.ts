import { vi } from 'vite-plus/test';

export class Disposable {
  static from(...disposables: Array<{ dispose(): any }>) {
    return new Disposable(() => {
      for (const disposable of disposables) disposable.dispose();
    });
  }

  private disposed = false;

  constructor(private readonly callOnDispose: () => any) {}

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.callOnDispose?.();
  }
}

export class EventEmitter<T> {
  private readonly listeners = new Set<(e: T) => any>();

  readonly event = (listener: (e: T) => any): Disposable => {
    this.listeners.add(listener);
    return new Disposable(() => {
      this.listeners.delete(listener);
    });
  };

  fire(data: T) {
    for (const listener of Array.from(this.listeners)) listener(data);
  }

  dispose() {
    this.listeners.clear();
  }

  /** Test-only: lets a spec assert that a listener was actually released. */
  get listenerCount() {
    return this.listeners.size;
  }
}

const URI_PATTERN =
  /^([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;

function joinPosix(base: string, ...parts: string[]) {
  const segments = [base, ...parts].join('/').split('/');
  const out: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }

  const joined = out.join('/');
  return base.startsWith('/') ? `/${joined}` : joined;
}

export class Uri {
  private constructor(
    readonly scheme: string,
    readonly authority: string,
    readonly path: string,
    readonly query: string,
    readonly fragment: string
  ) {}

  static file(path: string) {
    const normalized = path.replace(/\\/g, '/');
    return new Uri(
      'file',
      '',
      normalized.startsWith('/') ? normalized : `/${normalized}`,
      '',
      ''
    );
  }

  static parse(value: string) {
    const match = URI_PATTERN.exec(value);
    if (!match) return new Uri('file', '', value, '', '');
    return new Uri(
      match[1],
      match[3] ?? '',
      match[4] ?? '',
      match[6] ?? '',
      match[8] ?? ''
    );
  }

  static joinPath(base: Uri, ...paths: string[]) {
    return new Uri(
      base.scheme,
      base.authority,
      joinPosix(base.path, ...paths),
      base.query,
      base.fragment
    );
  }

  get fsPath() {
    return this.path;
  }

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }) {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }

  toString() {
    const query = this.query ? `?${this.query}` : '';
    const fragment = this.fragment ? `#${this.fragment}` : '';
    return `${this.scheme}://${this.authority}${this.path}${query}${fragment}`;
  }

  toJSON() {
    return this.toString();
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export type ConfigurationInspect = {
  key?: string;
  defaultValue?: unknown;
  globalValue?: unknown;
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
};

/**
 * Builds a WorkspaceConfiguration double. Hand it to a spec with
 * workspace.getConfiguration.mockReturnValue(createWorkspaceConfiguration(...)).
 */
export function createWorkspaceConfiguration(options?: {
  values?: Record<string, unknown>;
  inspect?: Record<string, ConfigurationInspect | undefined>;
}) {
  const values = options?.values ?? {};
  const inspects = options?.inspect ?? {};

  return {
    get: vi.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue
    ),
    has: vi.fn((key: string) => key in values),
    inspect: vi.fn((key: string) => inspects[key]),
    update: vi.fn(async () => undefined),
  };
}

export type MockWorkspaceConfiguration = ReturnType<
  typeof createWorkspaceConfiguration
>;

const configurationEmitter = new EventEmitter<{
  affectsConfiguration: (section: string, scope?: unknown) => boolean;
}>();

export const workspace = {
  fs: {
    readFile: vi.fn(async (_uri: Uri): Promise<Uint8Array> => new Uint8Array()),
    writeFile: vi.fn(async (_uri: Uri, _content: Uint8Array) => undefined),
    delete: vi.fn(async (_uri: Uri) => undefined),
  },
  getConfiguration: vi.fn((_section?: string): MockWorkspaceConfiguration =>
    createWorkspaceConfiguration()
  ),
  onDidChangeConfiguration: vi.fn((listener: (e: any) => any) =>
    configurationEmitter.event(listener)
  ),
  workspaceFolders: undefined as Array<{ uri: Uri }> | undefined,
};

export const window = {
  showOpenDialog: vi.fn(async (): Promise<Uri[] | undefined> => undefined),
  showSaveDialog: vi.fn(async (): Promise<Uri | undefined> => undefined),
  showInformationMessage: vi.fn(async () => undefined),
  showTextDocument: vi.fn(async () => undefined),
  createWebviewPanel: vi.fn(),
  registerCustomEditorProvider: vi.fn(() => new Disposable(() => undefined)),
};

export const commands = {
  registerCommand: vi.fn(
    (_command: string, _callback: (...args: any[]) => any) =>
      new Disposable(() => undefined)
  ),
  executeCommand: vi.fn(async () => undefined),
};

/**
 * Fires workspace.onDidChangeConfiguration. affects decides what
 * event.affectsConfiguration(section) answers — pass the sections that
 * should be reported as changed.
 */
export function fireConfigurationChange(affects: string[] = []) {
  configurationEmitter.fire({
    affectsConfiguration: (section: string) => affects.includes(section),
  });
}

/** Builds a vscode.Webview double. */
export function createWebview() {
  const messageEmitter = new EventEmitter<any>();

  return {
    html: '',
    options: {} as Record<string, unknown>,
    cspSource: 'vscode-webview://mock',
    asWebviewUri: vi.fn((uri: Uri) =>
      Uri.parse(`https://mock.vscode-cdn.net${uri.path}`)
    ),
    postMessage: vi.fn(async (_message: any) => true),
    onDidReceiveMessage: vi.fn((listener: (e: any) => any) =>
      messageEmitter.event(listener)
    ),
    /** Test-only: simulates the webview posting a message to the host. */
    __receive: (message: any) => messageEmitter.fire(message),
  };
}

export type MockWebview = ReturnType<typeof createWebview>;

/** Builds a vscode.ExtensionContext double. */
export function createExtensionContext(extensionPath = '/ext') {
  return {
    extensionUri: Uri.file(extensionPath),
    extensionPath,
    subscriptions: [] as Array<{ dispose(): any }>,
    globalState: { get: vi.fn(), update: vi.fn(async () => undefined) },
    workspaceState: { get: vi.fn(), update: vi.fn(async () => undefined) },
  };
}

export type MockExtensionContext = ReturnType<typeof createExtensionContext>;

/** Builds a vscode.WebviewPanel double around createWebview(). */
export function createWebviewPanel(webview = createWebview()) {
  const disposeEmitter = new EventEmitter<void>();

  return {
    webview,
    visible: true,
    active: true,
    onDidDispose: disposeEmitter.event,
    onDidChangeViewState: vi.fn(() => new Disposable(() => undefined)),
    reveal: vi.fn(),
    dispose: vi.fn(() => disposeEmitter.fire()),
    /** Test-only: fires onDidDispose the way VSCode does on panel close. */
    __dispose: () => disposeEmitter.fire(),
  };
}

export type MockWebviewPanel = ReturnType<typeof createWebviewPanel>;

const spies = [
  workspace.fs.readFile,
  workspace.fs.writeFile,
  workspace.fs.delete,
  workspace.getConfiguration,
  workspace.onDidChangeConfiguration,
  window.showOpenDialog,
  window.showSaveDialog,
  window.showInformationMessage,
  window.showTextDocument,
  window.createWebviewPanel,
  window.registerCustomEditorProvider,
  commands.registerCommand,
  commands.executeCommand,
];

/**
 * Restores every spy to the default implementation declared above and drops
 * any listener a previous spec left on onDidChangeConfiguration. Call it from
 * beforeEach — the module is shared across a file's tests.
 */
export function resetVscodeMock() {
  for (const spy of spies) spy.mockReset();

  workspace.fs.readFile.mockImplementation(async () => new Uint8Array());
  workspace.fs.writeFile.mockImplementation(async () => undefined);
  workspace.fs.delete.mockImplementation(async () => undefined);
  workspace.getConfiguration.mockImplementation(() =>
    createWorkspaceConfiguration()
  );
  workspace.onDidChangeConfiguration.mockImplementation(listener =>
    configurationEmitter.event(listener)
  );
  workspace.workspaceFolders = undefined;

  window.showOpenDialog.mockImplementation(async () => undefined);
  window.showSaveDialog.mockImplementation(async () => undefined);
  window.showInformationMessage.mockImplementation(async () => undefined);
  window.showTextDocument.mockImplementation(async () => undefined);
  window.registerCustomEditorProvider.mockImplementation(
    () => new Disposable(() => undefined)
  );

  commands.registerCommand.mockImplementation(
    () => new Disposable(() => undefined)
  );
  commands.executeCommand.mockImplementation(async () => undefined);

  configurationEmitter.dispose();
}
