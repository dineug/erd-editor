import { Schema } from 'effect';

/** Bumped on any wire change; hello carries it and the hub refuses a mismatch. */
export const HUB_PROTOCOL_VERSION = 1;

export const HubErrorCode = {
  protocolMismatch: 'protocolMismatch',
  unauthorized: 'unauthorized',
  outsideWorkspace: 'outsideWorkspace',
  notFound: 'notFound',
  notOpen: 'notOpen',
  readonly: 'readonly',
  hubDisabled: 'hubDisabled',
  /** A malformed request, an unknown method or a missing path. */
  badRequest: 'badRequest',
  /** The hub failed: a handler threw or its result could not be framed. */
  internal: 'internal',
} as const;
export type HubErrorCode = (typeof HubErrorCode)[keyof typeof HubErrorCode];

/** The values of the HubErrorCode map as literals; any other code fails to decode. */
export const HubErrorCodeSchema = Schema.Literals(Object.values(HubErrorCode));

export const HubError = Schema.Struct({
  code: HubErrorCodeSchema,
  message: Schema.String,
  hubProtocolVersion: Schema.optionalKey(Schema.Number),
  clientProtocolVersion: Schema.optionalKey(Schema.Number),
});
export type HubError = typeof HubError.Type;

export const DocumentInfo = Schema.Struct({
  path: Schema.String,
  open: Schema.Boolean,
  active: Schema.Boolean,
  dirty: Schema.Boolean,
  readonly: Schema.Boolean,
});
export type DocumentInfo = typeof DocumentInfo.Type;

/**
 * What a peer seeds itself from on join. snapshotVersion is the highest action
 * version the hub had seen when it captured initialValue.
 */
export const JoinResult = Schema.Struct({
  initialValue: Schema.String,
  snapshotVersion: Schema.Int,
  readonly: Schema.Boolean,
});
export type JoinResult = typeof JoinResult.Type;

/**
 * Params or a result no reader looks at: any object decodes with whatever fields
 * it has, so a field a newer writer adds gets through, as it does a struct.
 */
const OpenRecord = Schema.Record(Schema.String, Schema.Unknown);

const Actions = Schema.mutable(Schema.Array(Schema.Unknown));

const PathParams = Schema.Struct({ path: Schema.String });

/**
 * Sent once the first webview of the document reports ready. opened is false
 * when a ready editor already showed the document and nothing was opened.
 */
const OpenDocumentResult = Schema.Struct({
  path: Schema.String,
  opened: Schema.Boolean,
  webviews: Schema.Int,
});

function request<const M extends string, P extends Schema.Constraint>(
  method: M,
  params: P
) {
  return Schema.Struct({
    id: Schema.Int,
    method: Schema.Literal(method),
    params,
  });
}

/** Both answers a request can get, each naming the method it answers. */
function response<const M extends string, R extends Schema.Constraint>(
  method: M,
  result: R
) {
  return [
    Schema.Struct({
      id: Schema.Int,
      ok: Schema.Literal(true),
      method: Schema.Literal(method),
      result,
    }),
    Schema.Struct({
      id: Schema.Int,
      ok: Schema.Literal(false),
      method: Schema.Literal(method),
      error: HubError,
    }),
  ] as const;
}

/**
 * A notification never carries an id: a frame with an id key is refused, so a
 * peer never takes an answer to its request for a notification.
 */
function notification<const M extends string, P extends Schema.Constraint>(
  method: M,
  params: P
) {
  return Schema.Struct({
    id: Schema.optionalKey(Schema.Never),
    method: Schema.Literal(method),
    params,
  });
}

/** What a peer asks of the hub; every peer to hub frame is one of these. */
export const HubRequest = Schema.Union([
  request(
    'hello',
    Schema.Struct({
      token: Schema.String,
      protocolVersion: Schema.Int,
      client: Schema.String,
    })
  ),
  request('listDocuments', OpenRecord),
  request(
    'openDocument',
    Schema.Struct({
      path: Schema.String,
      /** This and initialValue may also be undefined, which a frame leaves out. */
      create: Schema.optional(Schema.Boolean),
      initialValue: Schema.optional(Schema.String),
    })
  ),
  request('join', PathParams),
  request(
    'applyActions',
    Schema.Struct({
      path: Schema.String,
      /** A batch of the peer's own actions for every webview and every other peer. */
      actions: Actions,
    })
  ),
  request('leave', PathParams),
  request('save', PathParams),
]);

/** Distributes over the method, so narrowing on method also narrows params. */
export type HubRequest<M extends HubMethod = HubMethod> = Extract<
  typeof HubRequest.Type,
  { method: M }
>;
export type HubMethod = (typeof HubRequest.Type)['method'];
export type HubRequestParams = { [M in HubMethod]: HubRequest<M>['params'] };

export const HubResponse = Schema.Union([
  ...response(
    'hello',
    Schema.Struct({
      protocolVersion: Schema.Int,
      ide: Schema.String,
      version: Schema.String,
    })
  ),
  ...response(
    'listDocuments',
    Schema.Struct({ documents: Schema.mutable(Schema.Array(DocumentInfo)) })
  ),
  ...response('openDocument', OpenDocumentResult),
  ...response('join', JoinResult),
  ...response(
    'applyActions',
    Schema.Struct({
      /** How many ready webviews the batch was handed to. */
      webviews: Schema.Int,
    })
  ),
  ...response('leave', OpenRecord),
  ...response('save', Schema.Struct({ saved: Schema.Boolean })),
]);

/** Distributes over the method, so narrowing on method also narrows result. */
export type HubResponse<M extends HubMethod = HubMethod> = Extract<
  typeof HubResponse.Type,
  { method: M }
>;
export type HubResultMap = {
  [M in HubMethod]: Extract<HubResponse<M>, { ok: true }>['result'];
};

/**
 * Notifications carry no id, get no response and flow from the hub to a peer
 * only; a peer hands its own actions over with the applyActions request.
 */
export const HubNotification = Schema.Union([
  notification(
    'actions',
    Schema.Struct({
      path: Schema.String,
      /** Actions of a webview or of another peer on a document the peer joined. */
      actions: Actions,
    })
  ),
  notification('documentClosed', PathParams),
]);

export type HubNotification<
  M extends HubNotificationMethod = HubNotificationMethod,
> = Extract<typeof HubNotification.Type, { method: M }>;
export type HubNotificationMethod = (typeof HubNotification.Type)['method'];
export type HubNotificationParams = {
  [M in HubNotificationMethod]: HubNotification<M>['params'];
};

/** Every frame a peer sends after connecting: requests only. */
export const PeerToHubMessage = HubRequest;
export type PeerToHubMessage = HubRequest;

/** Every frame the hub sends a peer: responses and notifications. */
export const HubToPeerMessage = Schema.Union([
  ...HubResponse.members,
  ...HubNotification.members,
]);
export type HubToPeerMessage = HubResponse | HubNotification;

/** The request method names in declaration order, read off the HubRequest members. */
export const HUB_REQUEST_METHODS: readonly HubMethod[] = Object.freeze(
  HubRequest.members.map(member => member.fields.method.literal)
);

/** The notification method names in declaration order, read off the HubNotification members. */
export const HUB_NOTIFICATION_METHODS: readonly HubNotificationMethod[] =
  Object.freeze(
    HubNotification.members.map(member => member.fields.method.literal)
  );

/** A failure the hub turns into a HubError response carrying the same code. */
export class HubRequestError extends Schema.TaggedError<HubRequestError>()(
  'HubRequestError',
  { code: HubErrorCodeSchema, message: Schema.String }
) {}

/**
 * Names both versions and the side that is behind, which is the side to
 * update. Meant for a hub and a client whose versions differ.
 */
export function protocolMismatchMessage(hub: number, client: number): string {
  const action =
    hub < client
      ? `Update the ERD Editor extension or plugin in the editor until its hub speaks protocol ${client}`
      : `Update the MCP server (npx -y @dineug/erd-editor-mcp@latest) until it speaks protocol ${hub}`;

  return `The ERD Editor hub speaks protocol ${hub} but the client speaks protocol ${client}. ${action}.`;
}
