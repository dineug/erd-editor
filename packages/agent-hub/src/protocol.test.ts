import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  HUB_NOTIFICATION_METHODS,
  HUB_PROTOCOL_VERSION,
  HUB_REQUEST_METHODS,
  type HubError,
  HubErrorCode,
  type HubMethod,
  type HubNotification,
  type HubNotificationParams,
  type HubRequest,
  HubRequestError,
  type HubRequestParams,
  type HubResponse,
  type HubResultMap,
  type HubToPeerMessage,
  type JoinResult,
  type PeerToHubMessage,
  protocolMismatchMessage,
} from '@/protocol';

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

  it('gives every request method a result type', () => {
    expectTypeOf<keyof HubResultMap>().toEqualTypeOf<HubMethod>();
    expectTypeOf<keyof HubRequestParams>().toEqualTypeOf<HubMethod>();
  });
});

describe('message direction', () => {
  it('lets a peer send requests only, so its actions travel as applyActions', () => {
    expectTypeOf<PeerToHubMessage>().toEqualTypeOf<HubRequest>();
    expectTypeOf<
      Extract<PeerToHubMessage, { method: 'applyActions' }>['params']
    >().toEqualTypeOf<{ path: string; actions: unknown[] }>();
    expectTypeOf<
      Extract<PeerToHubMessage, { method: 'actions' }>
    >().toEqualTypeOf<never>();
  });

  it('sends a peer responses and the two notifications, actions among them', () => {
    expectTypeOf<HubToPeerMessage>().toEqualTypeOf<
      HubResponse | HubNotification
    >();
    expectTypeOf<
      Extract<HubToPeerMessage, { method: 'actions'; params: unknown }>
    >().toEqualTypeOf<HubNotification<'actions'>>();
    expectTypeOf<HubNotificationParams['actions']>().toEqualTypeOf<{
      path: string;
      actions: unknown[];
    }>();
  });

  it('answers applyActions with the number of webviews that took the batch', () => {
    expectTypeOf<
      Extract<HubResponse, { ok: true; method: 'applyActions' }>['result']
    >().toEqualTypeOf<{ webviews: number }>();
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
  });

  it('pairs each request method with its own params', () => {
    expectTypeOf<HubRequest<'hello'>['params']>().toEqualTypeOf<{
      token: string;
      protocolVersion: number;
      client: string;
    }>();
    expectTypeOf<HubRequest<'save'>['params']>().toEqualTypeOf<{
      path: string;
    }>();
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
});

describe('HubRequestError', () => {
  it('is an Error that carries its code', () => {
    const error = new HubRequestError(HubErrorCode.notOpen, 'closed');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HubRequestError');
    expect(error.code).toBe('notOpen');
    expect(error.message).toBe('closed');
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
