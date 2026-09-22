/** Bumped on any wire change; hello carries it and the hub refuses a mismatch. */
export const HUB_PROTOCOL_VERSION = 1;

export type DocumentInfo = {
  path: string;
  open: boolean;
  active: boolean;
  dirty: boolean;
  readonly: boolean;
};

/**
 * What a peer seeds itself from on join. snapshotVersion is the highest action
 * version the hub had seen when it captured initialValue.
 */
export type JoinResult = {
  initialValue: string;
  snapshotVersion: number;
  readonly: boolean;
};

export type HubRequestParams = {
  hello: { token: string; protocolVersion: number; client: string };
  listDocuments: Record<string, never>;
  openDocument: { path: string; create?: boolean; initialValue?: string };
  join: { path: string };
  leave: { path: string };
  save: { path: string };
};

export type HubResultMap = {
  hello: { protocolVersion: number; ide: string; version: string };
  listDocuments: { documents: DocumentInfo[] };
  /** Sent once the first webview of the document reports ready. */
  openDocument: { path: string; opened: boolean; webviews: number };
  join: JoinResult;
  leave: Record<string, never>;
  save: { saved: boolean };
};

export type HubMethod = keyof HubRequestParams;

export type HubRequest<M extends HubMethod = HubMethod> = M extends HubMethod
  ? { id: number; method: M; params: HubRequestParams[M] }
  : never;

export const HubErrorCode = {
  protocolMismatch: 'protocolMismatch',
  unauthorized: 'unauthorized',
  outsideWorkspace: 'outsideWorkspace',
  notFound: 'notFound',
  notOpen: 'notOpen',
  readonly: 'readonly',
  hubDisabled: 'hubDisabled',
} as const;
export type HubErrorCode = (typeof HubErrorCode)[keyof typeof HubErrorCode];

export type HubError = {
  code: HubErrorCode;
  message: string;
  hubProtocolVersion?: number;
  clientProtocolVersion?: number;
};

/** Distributes over the method, so narrowing on method also narrows result. */
export type HubResponse<M extends HubMethod = HubMethod> = M extends HubMethod
  ?
      | { id: number; ok: true; method: M; result: HubResultMap[M] }
      | { id: number; ok: false; method: M; error: HubError }
  : never;

/** Notifications carry no id and get no response; actions flows both ways. */
export type HubNotificationParams = {
  actions: { path: string; actions: unknown[] };
  documentClosed: { path: string };
};

export type HubNotificationMethod = keyof HubNotificationParams;

export type HubNotification<
  M extends HubNotificationMethod = HubNotificationMethod,
> = M extends HubNotificationMethod
  ? { method: M; params: HubNotificationParams[M] }
  : never;

/** The request method names, pinned against HubRequest by protocol.test.ts. */
export const HUB_REQUEST_METHODS = Object.freeze([
  'hello',
  'listDocuments',
  'openDocument',
  'join',
  'leave',
  'save',
] as const) satisfies readonly HubMethod[];

/** The notification method names, pinned against HubNotification by protocol.test.ts. */
export const HUB_NOTIFICATION_METHODS = Object.freeze([
  'actions',
  'documentClosed',
] as const) satisfies readonly HubNotificationMethod[];

/** A failure the hub turns into a HubError response carrying the same code. */
export class HubRequestError extends Error {
  readonly code: HubErrorCode;

  constructor(code: HubErrorCode, message: string) {
    super(message);
    this.name = 'HubRequestError';
    this.code = code;
  }
}

/**
 * Names both versions and the side that is behind, which is the side to
 * update. Meant for a hub and a client whose versions differ.
 */
export function protocolMismatchMessage(hub: number, client: number): string {
  const action =
    hub < client
      ? `Update the ERD Editor extension in the IDE until its hub speaks protocol ${client}`
      : `Update the MCP server (npx -y @dineug/erd-editor-mcp@latest) until it speaks protocol ${hub}`;

  return `The ERD Editor hub speaks protocol ${hub} but the client speaks protocol ${client}. ${action}.`;
}
