import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentSource } from '@/components/erd-viewer/documentSource';

type Answer = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

type FakeRequest = {
  url: string;
  init: { signal: AbortSignal };
  respond: (answer: Partial<Answer> & { body?: string }) => void;
  fail: (error: unknown) => void;
};

/** A fetch that answers when the spec says and rejects once its signal aborts, as the browser's does. */
function stubFetch() {
  const requests: FakeRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string, init: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted', 'AbortError'))
          );
          requests.push({
            url,
            init,
            respond: ({ body = '', ...answer }) =>
              resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(body),
                ...answer,
              }),
            fail: reject,
          });
        })
    )
  );
  return requests;
}

function createSource() {
  const applied: string[] = [];
  const loads = vi.fn();
  const errors = vi.fn();
  const source = createDocumentSource({
    apply: text => {
      JSON.parse(text);
      applied.push(text);
    },
    onLoad: loads,
    onError: errors,
  });
  return { source, applied, loads, errors };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDocumentSource', () => {
  it('GETs the url, hands the text over and reports the load once', async () => {
    const requests = stubFetch();
    const { source, applied, loads, errors } = createSource();

    const loaded = source.load('fixture.erd.json');
    expect(source.state.status).toBe('loading');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('fixture.erd.json');
    expect(Object.keys(requests[0].init)).toEqual(['signal']);

    requests[0].respond({ body: '{"version":"3.0.0"}' });
    await loaded;

    expect(applied).toEqual(['{"version":"3.0.0"}']);
    expect(loads).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    expect(source.state.status).toBe('idle');
  });

  it('reports a response that is not ok, naming its status, and hands nothing over', async () => {
    const requests = stubFetch();
    const { source, applied, loads, errors } = createSource();

    const loaded = source.load('missing.erd.json');
    requests[0].respond({ ok: false, status: 404, statusText: 'Not Found' });
    await loaded;

    expect(applied).toEqual([]);
    expect(loads).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toContain(
      'GET missing.erd.json answered 404 Not Found'
    );
    expect(source.state.status).toBe('error');
  });

  it('reports text the document parser refuses, and a fetch the network refused', async () => {
    const requests = stubFetch();
    const { source, errors } = createSource();

    const parsed = source.load('broken.erd.json');
    requests[0].respond({ body: '<html>' });
    await parsed;
    expect(errors.mock.calls[0][0]).toBeInstanceOf(SyntaxError);

    const offline = source.load('offline.erd.json');
    const refusal = new TypeError('Failed to fetch');
    requests[1].fail(refusal);
    await offline;
    expect(errors.mock.calls[1][0]).toBe(refusal);
    expect(source.state.status).toBe('error');
  });

  it('aborts the fetch a later load replaces, so a late answer never lands over the later document', async () => {
    const requests = stubFetch();
    const { source, applied, loads, errors } = createSource();

    const first = source.load('first.erd.json');
    const second = source.load('second.erd.json');

    expect(requests[0].init.signal.aborted).toBe(true);
    expect(requests[1].init.signal.aborted).toBe(false);

    requests[1].respond({ body: '"second"' });
    await second;
    requests[0].respond({ body: '"first"' });
    await first;

    expect(applied).toEqual(['"second"']);
    expect(loads).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
  });

  it('drops an answer whose body arrives after a later load began', async () => {
    const requests: FakeRequest[] = [];
    let releaseBody: (text: string) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { signal: AbortSignal }) => {
        requests.push({ url, init } as FakeRequest);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () =>
            new Promise<string>(resolve => {
              releaseBody = resolve;
            }),
        });
      })
    );
    const { source, applied, loads } = createSource();

    const first = source.load('first.erd.json');
    await Promise.resolve();
    await Promise.resolve();
    const release = releaseBody;
    void source.load('second.erd.json');
    release('"first"');
    await first;

    expect(applied).toEqual([]);
    expect(loads).not.toHaveBeenCalled();
  });

  it('cancels a fetch still running, calling nothing back, and clears a failure', async () => {
    const requests = stubFetch();
    const { source, loads, errors } = createSource();

    source.cancel();
    expect(source.state.status).toBe('idle');

    const loaded = source.load('fixture.erd.json');
    source.cancel();
    await loaded;

    expect(requests[0].init.signal.aborted).toBe(true);
    expect(source.state.status).toBe('idle');
    expect(loads).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    const failed = source.load('missing.erd.json');
    requests[1].respond({ ok: false, status: 500, statusText: '' });
    await failed;
    expect(source.state.status).toBe('error');
    source.cancel();
    expect(source.state.status).toBe('idle');
  });
});
