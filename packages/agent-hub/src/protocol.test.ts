import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import { encodeFrame } from '@/framing';
import {
  DocumentInfo,
  HUB_NOTIFICATION_METHODS,
  HUB_PROTOCOL_VERSION,
  HUB_REQUEST_METHODS,
  HubError,
  HubErrorCode,
  HubErrorCodeSchema,
  type HubMethod,
  HubNotification,
  type HubNotificationMethod,
  type HubNotificationParams,
  HubRequest,
  HubRequestError,
  type HubRequestParams,
  HubResponse,
  type HubResultMap,
  HubToPeerMessage,
  JoinResult,
  PeerToHubMessage,
  protocolMismatchMessage,
} from '@/protocol';

const decodeRequest = Schema.decodeUnknownExit(HubRequest);
const decodeHubToPeer = Schema.decodeUnknownExit(HubToPeerMessage);

describe('method catalogue', () => {
  it('lists every request method of HubRequest and nothing else', () => {
    expectTypeOf<(typeof HUB_REQUEST_METHODS)[number]>().toEqualTypeOf<
      HubRequest['method']
    >();
    expectTypeOf<HubRequest['method']>().toEqualTypeOf<
      | 'hello'
      | 'listDocuments'
      | 'openDocument'
      | 'join'
      | 'applyActions'
      | 'leave'
      | 'save'
    >();
    expect([...HUB_REQUEST_METHODS]).toEqual([
      'hello',
      'listDocuments',
      'openDocument',
      'join',
      'applyActions',
      'leave',
      'save',
    ]);
  });

  it('lists every notification method of HubNotification and nothing else', () => {
    expectTypeOf<(typeof HUB_NOTIFICATION_METHODS)[number]>().toEqualTypeOf<
      HubNotification['method']
    >();
    expectTypeOf<HubNotification['method']>().toEqualTypeOf<
      'actions' | 'documentClosed'
    >();
    expect([...HUB_NOTIFICATION_METHODS]).toEqual([
      'actions',
      'documentClosed',
    ]);
  });

  it('reads both lists off the members of the message schemas', () => {
    expect(
      HubRequest.members.map(member => member.fields.method.literal)
    ).toEqual([...HUB_REQUEST_METHODS]);
    expect(
      HubNotification.members.map(member => member.fields.method.literal)
    ).toEqual([...HUB_NOTIFICATION_METHODS]);
  });

  it('has no rejoin message: reseeding after an auto open is a session step', () => {
    expect(HUB_REQUEST_METHODS).not.toContain('rejoin');
    expect(HUB_NOTIFICATION_METHODS).not.toContain('rejoin');
  });

  it('keeps request and notification names apart, each listed once', () => {
    const all = [...HUB_REQUEST_METHODS, ...HUB_NOTIFICATION_METHODS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('freezes both lists', () => {
    expect(Object.isFrozen(HUB_REQUEST_METHODS)).toBe(true);
    expect(Object.isFrozen(HUB_NOTIFICATION_METHODS)).toBe(true);
  });

  it('gives every request method a result type and a response', () => {
    expectTypeOf<keyof HubResultMap>().toEqualTypeOf<HubMethod>();
    expectTypeOf<keyof HubRequestParams>().toEqualTypeOf<HubMethod>();
    expectTypeOf<HubResponse['method']>().toEqualTypeOf<HubMethod>();
    expectTypeOf<
      keyof HubNotificationParams
    >().toEqualTypeOf<HubNotificationMethod>();
  });
});

describe('message direction', () => {
  it('lets a peer send requests only, so its actions travel as applyActions', () => {
    expectTypeOf<PeerToHubMessage>().toEqualTypeOf<HubRequest>();
    expect(PeerToHubMessage).toBe(HubRequest);
    expectTypeOf<
      Extract<PeerToHubMessage, { method: 'applyActions' }>['params']
    >().toEqualTypeOf<{ readonly path: string; readonly actions: unknown[] }>();
    expectTypeOf<
      Extract<PeerToHubMessage, { method: 'actions' }>
    >().toEqualTypeOf<never>();
  });

  it('sends a peer responses and the two notifications, actions among them', () => {
    expectTypeOf<HubToPeerMessage>().toEqualTypeOf<
      HubResponse | HubNotification
    >();
    expectTypeOf<
      typeof HubToPeerMessage.Type
    >().toEqualTypeOf<HubToPeerMessage>();
    expectTypeOf<
      Extract<HubToPeerMessage, { method: 'actions'; params: unknown }>
    >().toEqualTypeOf<HubNotification<'actions'>>();
    expectTypeOf<HubNotificationParams['actions']>().toEqualTypeOf<{
      readonly path: string;
      readonly actions: unknown[];
    }>();
  });

  it('answers applyActions with the number of webviews that took the batch', () => {
    expectTypeOf<
      Extract<HubResponse, { ok: true; method: 'applyActions' }>['result']
    >().toEqualTypeOf<{ readonly webviews: number }>();
  });
});

describe('message types', () => {
  it('narrows a response result by its method', () => {
    expectTypeOf<
      Extract<HubResponse, { ok: true; method: 'join' }>['result']
    >().toEqualTypeOf<JoinResult>();
    expectTypeOf<
      Extract<HubResponse, { ok: false; method: 'save' }>['error']
    >().toEqualTypeOf<HubError>();
    expectTypeOf<HubResultMap['listDocuments']>().toEqualTypeOf<{
      readonly documents: DocumentInfo[];
    }>();
  });

  it('pairs each request method with its own params', () => {
    expectTypeOf<HubRequest<'hello'>['params']>().toEqualTypeOf<{
      readonly token: string;
      readonly protocolVersion: number;
      readonly client: string;
    }>();
    expectTypeOf<HubRequest<'save'>['params']>().toEqualTypeOf<{
      readonly path: string;
    }>();
    expectTypeOf<HubRequestParams['openDocument']>().toEqualTypeOf<{
      readonly path: string;
      readonly create?: boolean;
      readonly initialValue?: string;
    }>();
  });

  it('derives each type from the schema of the same name', () => {
    expectTypeOf<typeof HubError.Type>().toEqualTypeOf<HubError>();
    expectTypeOf<typeof DocumentInfo.Type>().toEqualTypeOf<DocumentInfo>();
    expectTypeOf<typeof JoinResult.Type>().toEqualTypeOf<JoinResult>();
    expectTypeOf<
      typeof HubErrorCodeSchema.Type
    >().toEqualTypeOf<HubErrorCode>();
  });
});

/** Frames as the MCP server, the hub and the e2e peer write them today. */
const WIRE = {
  requests: [
    '{"id":1,"method":"hello","params":{"token":"t","protocolVersion":1,"client":"claude-code"}}',
    '{"id":2,"method":"listDocuments","params":{}}',
    '{"id":3,"method":"openDocument","params":{"path":"/w/a.erd","create":true,"initialValue":"{}"}}',
    '{"id":4,"method":"openDocument","params":{"path":"/w/a.erd"}}',
    '{"id":5,"method":"join","params":{"path":"/w/a.erd"}}',
    '{"id":6,"method":"applyActions","params":{"path":"/w/a.erd","actions":[{"type":"table.add","payload":{"id":"x"}}]}}',
    '{"id":7,"method":"leave","params":{"path":"/w/a.erd"}}',
    '{"id":8,"method":"save","params":{"path":"/w/a.erd"}}',
  ],
  toPeer: [
    '{"id":1,"ok":true,"method":"hello","result":{"protocolVersion":1,"ide":"vscode","version":"2.9.0"}}',
    '{"id":2,"ok":true,"method":"listDocuments","result":{"documents":[{"path":"/w/a.erd","open":true,"active":false,"dirty":false,"readonly":false}]}}',
    '{"id":3,"ok":true,"method":"openDocument","result":{"path":"/w/a.erd","opened":true,"webviews":1}}',
    '{"id":5,"ok":true,"method":"join","result":{"initialValue":"{}","snapshotVersion":42,"readonly":false}}',
    '{"id":6,"ok":true,"method":"applyActions","result":{"webviews":2}}',
    '{"id":7,"ok":true,"method":"leave","result":{}}',
    '{"id":8,"ok":true,"method":"save","result":{"saved":true}}',
    '{"id":8,"ok":false,"method":"save","error":{"code":"notOpen","message":"no webview is ready"}}',
    `{"id":1,"ok":false,"method":"hello","error":{"code":"protocolMismatch","message":${JSON.stringify(protocolMismatchMessage(1, 2))},"hubProtocolVersion":1,"clientProtocolVersion":2}}`,
    '{"method":"actions","params":{"path":"/w/a.erd","actions":[{"type":"memo.add"}]}}',
    '{"method":"documentClosed","params":{"path":"/w/a.erd"}}',
  ],
};

describe('message schemas', () => {
  it.each(WIRE.requests)(
    'decodes and re-encodes a request to the same bytes: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(HubRequest)(JSON.parse(line));
      const encoded = Schema.encodeSync(HubRequest)(decoded);

      expect(encodeFrame(encoded)).toBe(`${line}\n`);
    }
  );

  it.each(WIRE.toPeer)(
    'decodes and re-encodes a hub frame to the same bytes: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(HubToPeerMessage)(
        JSON.parse(line)
      );
      const encoded = Schema.encodeSync(HubToPeerMessage)(decoded);

      expect(encodeFrame(encoded)).toBe(`${line}\n`);
    }
  );

  it('carries both versions of a protocol mismatch to the side that is behind', () => {
    const frame = {
      id: 1,
      ok: false,
      method: 'hello',
      error: {
        code: HubErrorCode.protocolMismatch,
        message: protocolMismatchMessage(HUB_PROTOCOL_VERSION, 2),
        hubProtocolVersion: HUB_PROTOCOL_VERSION,
        clientProtocolVersion: 2,
      },
    };

    expect(Schema.decodeUnknownSync(HubResponse)(frame)).toEqual(frame);
  });

  it('drops fields it does not know, so a newer writer still decodes', () => {
    const decoded = Schema.decodeUnknownSync(HubToPeerMessage)({
      method: 'documentClosed',
      params: { path: '/w/a.erd', reason: 'deleted' },
      sentAt: 1,
    });

    expect(decoded).toEqual({
      method: 'documentClosed',
      params: { path: '/w/a.erd' },
    });
  });

  it('takes any object as listDocuments params and as the leave result', () => {
    expectTypeOf<HubRequestParams['listDocuments']>().toEqualTypeOf<{
      readonly [x: string]: unknown;
    }>();
    expectTypeOf<HubResultMap['leave']>().toEqualTypeOf<{
      readonly [x: string]: unknown;
    }>();

    const request = { id: 2, method: 'listDocuments', params: { page: 2 } };
    const response = { id: 7, ok: true, method: 'leave', result: { left: 1 } };

    expect(Schema.decodeUnknownSync(HubRequest)(request)).toEqual(request);
    expect(Schema.decodeUnknownSync(HubToPeerMessage)(response)).toEqual(
      response
    );
  });

  it.each([
    ['an unknown method', { id: 1, method: 'rejoin', params: {} }],
    ['a missing path', { id: 1, method: 'join', params: {} }],
    [
      'actions that are no array',
      { id: 1, method: 'applyActions', params: { path: '/a', actions: {} } },
    ],
    ['a fractional id', { id: 1.5, method: 'save', params: { path: '/a' } }],
    ['a missing id', { method: 'save', params: { path: '/a' } }],
    [
      'listDocuments params that are an array',
      { id: 1, method: 'listDocuments', params: [] },
    ],
    [
      'listDocuments params that are null',
      { id: 1, method: 'listDocuments', params: null },
    ],
    [
      'a notification',
      { method: 'actions', params: { path: '/a', actions: [] } },
    ],
  ])('refuses a request with %s', (_, frame) => {
    expect(Exit.isFailure(decodeRequest(frame))).toBe(true);
  });

  it.each([
    [
      'an unknown error code',
      {
        id: 1,
        ok: false,
        method: 'save',
        error: { code: 'gone', message: 'x' },
      },
    ],
    [
      'a result for the wrong method',
      { id: 1, ok: true, method: 'save', result: { webviews: 1 } },
    ],
    [
      'ok that is no boolean',
      { id: 1, ok: 'yes', method: 'save', result: { saved: true } },
    ],
    [
      'a leave result that is no object',
      { id: 1, ok: true, method: 'leave', result: 'left' },
    ],
    ['a request', { id: 1, method: 'save', params: { path: '/a' } }],
  ])('refuses a hub frame with %s', (_, frame) => {
    expect(Exit.isFailure(decodeHubToPeer(frame))).toBe(true);
  });
});

describe('HubErrorCode', () => {
  it('pins the nine codes, each equal to its key', () => {
    expect(HubErrorCode).toEqual({
      protocolMismatch: 'protocolMismatch',
      unauthorized: 'unauthorized',
      outsideWorkspace: 'outsideWorkspace',
      notFound: 'notFound',
      notOpen: 'notOpen',
      readonly: 'readonly',
      hubDisabled: 'hubDisabled',
      badRequest: 'badRequest',
      internal: 'internal',
    });
  });

  it('decodes exactly the nine codes of the map', () => {
    expect(HubErrorCodeSchema.literals).toEqual(Object.values(HubErrorCode));
    expect(Schema.is(HubErrorCodeSchema)('notOpen')).toBe(true);
    expect(Schema.is(HubErrorCodeSchema)('notopen')).toBe(false);
  });
});

describe('HubRequestError', () => {
  it('is an Error that carries its code, tagged for catchTag', () => {
    const error = new HubRequestError({
      code: HubErrorCode.notOpen,
      message: 'closed',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HubRequestError);
    expect(error.name).toBe('HubRequestError');
    expect(error._tag).toBe('HubRequestError');
    expect(error.code).toBe('notOpen');
    expect(error.message).toBe('closed');
  });

  it('refuses a code outside HubErrorCode', () => {
    expect(
      () => new HubRequestError({ code: 'gone' as HubErrorCode, message: 'x' })
    ).toThrow();
  });

  it('fails an effect and is caught by its tag', async () => {
    const code = await runTest(
      Effect.fail(
        new HubRequestError({
          code: HubErrorCode.outsideWorkspace,
          message: 'out',
        })
      ).pipe(
        Effect.catchTag('HubRequestError', error => Effect.succeed(error.code))
      )
    );

    expect(code).toBe('outsideWorkspace');
  });

  it('decodes from its encoded form into an instance', () => {
    const decoded = Schema.decodeUnknownSync(HubRequestError)({
      _tag: 'HubRequestError',
      code: 'notFound',
      message: 'missing',
    });

    expect(decoded).toBeInstanceOf(HubRequestError);
    expect(decoded.code).toBe('notFound');
    expect(decoded.message).toBe('missing');
  });
});

describe('protocolMismatchMessage', () => {
  it('starts at version 1', () => {
    expect(HUB_PROTOCOL_VERSION).toBe(1);
  });

  it('tells an older hub to update the IDE extension', () => {
    const message = protocolMismatchMessage(1, 2);

    expect(message).toContain('hub speaks protocol 1');
    expect(message).toContain('client speaks protocol 2');
    expect(message).toContain('Update the ERD Editor extension in the IDE');
    expect(message).not.toContain('@dineug/erd-editor-mcp');
  });

  it('tells an older client to update the MCP server', () => {
    const message = protocolMismatchMessage(3, 2);

    expect(message).toContain('hub speaks protocol 3');
    expect(message).toContain('client speaks protocol 2');
    expect(message).toContain('@dineug/erd-editor-mcp@latest');
    expect(message).not.toContain('extension in the IDE');
  });
});
