import { describe, expect, it } from 'vite-plus/test';

import { gtagSnippet } from './gtagSnippet';

type ScriptStub = { async?: boolean; src?: string };

function runSnippet(url: string, referrer = '') {
  const created: string[] = [];
  const appended: ScriptStub[] = [];
  const win: { dataLayer?: IArguments[]; gtag?: unknown } = {};
  const doc = {
    referrer,
    createElement: (tag: string): ScriptStub => {
      created.push(tag);
      return {};
    },
    head: {
      appendChild: (node: ScriptStub) => {
        appended.push(node);
      },
    },
  };

  new Function('location', 'window', 'document', gtagSnippet('G-TEST'))(
    new URL(url),
    win,
    doc
  );
  return { win, created, appended };
}

function configCalls(url: string, referrer?: string) {
  return (runSnippet(url, referrer).win.dataLayer ?? [])
    .map(entry => Array.from(entry))
    .filter(args => args[0] === 'config');
}

describe('gtagSnippet', () => {
  it('queues its calls as arguments objects and loads gtag.js once', () => {
    const { win, created, appended } = runSnippet('https://erd-editor.io/');

    expect(win.dataLayer).toHaveLength(2);
    for (const entry of win.dataLayer ?? []) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }
    const [js] = win.dataLayer ?? [];
    expect(js[0]).toBe('js');
    expect(js[1]).toBeInstanceOf(Date);
    expect(created).toEqual(['script']);
    expect(appended).toEqual([
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST',
      },
    ]);
  });

  it.each([
    'https://erd-editor.io/embed',
    'https://erd-editor.io/embed?src=https%3A%2F%2Fx%2Fa.erd.json#k',
    'https://erd-editor.io/Embed?src=https%3A%2F%2Fx%2Fa.erd.json',
    'https://erd-editor.io/%65mbed?src=https%3A%2F%2Fx%2Fa.erd.json',
    'https://erd-editor.io/%65mbed?src=a%ZZ',
    'https://erd-editor.io/embed/?src=https%3A%2F%2Fx%2Fa.erd.json',
  ])('gives %s the path alone as its page location', url => {
    expect(configCalls(url)).toEqual([
      ['config', 'G-TEST', { page_location: 'https://erd-editor.io/embed' }],
    ]);
  });

  it.each([
    'https://erd-editor.io/',
    'https://erd-editor.io/?schema=x',
    'https://erd-editor.io/live/#r,k',
    'https://erd-editor.io/embedded?x=1',
    'https://erd-editor.io/embed%2F?src=x',
  ])('leaves the page location of %s to gtag.js', url => {
    expect(configCalls(url)).toEqual([['config', 'G-TEST']]);
  });

  it.each([
    'https://erd-editor.io/embed',
    'https://erd-editor.io/embed?src=https%3A%2F%2Fx%2Fa.erd.json',
    'https://erd-editor.io/Embed/?src=https%3A%2F%2Fx%2Fa.erd.json',
    'https://erd-editor.io/%65mbed?src=a%ZZ',
  ])(
    'gives a page reached from %s the path alone as its referrer',
    referrer => {
      expect(configCalls('https://erd-editor.io/', referrer)).toEqual([
        ['config', 'G-TEST', { page_referrer: 'https://erd-editor.io/embed' }],
      ]);
    }
  );

  it('gives the path alone as location and referrer from /embed to /embed', () => {
    expect(
      configCalls(
        'https://erd-editor.io/embed?src=https%3A%2F%2Fx%2Fb.erd.json',
        'https://erd-editor.io/embed?src=https%3A%2F%2Fx%2Fa.erd.json'
      )
    ).toEqual([
      [
        'config',
        'G-TEST',
        {
          page_location: 'https://erd-editor.io/embed',
          page_referrer: 'https://erd-editor.io/embed',
        },
      ],
    ]);
  });

  it.each([
    'https://erd-editor.io/?schema=x',
    'https://erd-editor.io/embedded?x=1',
    'https://erd-editor.io/embed%2F?src=x',
    'https://blog.example/embed?src=x',
    'https://erd-editor.io.example/embed?src=x',
    'http://erd-editor.io/embed?src=x',
    'https://erd-editor.co/embed?src=x',
    'http://erd-editor.ioo/embed?src=x',
  ])('leaves the referrer %s to gtag.js', referrer => {
    expect(configCalls('https://erd-editor.io/', referrer)).toEqual([
      ['config', 'G-TEST'],
    ]);
  });

  it.each([
    'https://erd-editor.io/gdrive',
    'https://erd-editor.io/GDrive?file=x',
    'https://erd-editor.io/%67drive?state=x',
    'https://erd-editor.io/api/auth/callback?code=x',
  ])('loads no analytics on %s', url => {
    const { win, created, appended } = runSnippet(url);

    expect(win.dataLayer).toBeUndefined();
    expect(win.gtag).toBeUndefined();
    expect(created).toEqual([]);
    expect(appended).toEqual([]);
  });
});
