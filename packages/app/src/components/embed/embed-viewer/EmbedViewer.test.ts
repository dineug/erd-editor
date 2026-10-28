import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdViewer,
  FakeErdViewer,
  lastViewer,
  resetViewers,
} from '@/__test-utils__/erdViewer';
import { render } from '@/__test-utils__/render';
import EmbedViewer from '@/components/embed/embed-viewer/EmbedViewer';
import { parseEmbedParams } from '@/utils/embedOptions';
import { reportError } from '@/utils/reportError';

// The real viewer needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor/erd-viewer.js', () => ({}));
vi.mock('@/utils/reportError', () => ({ reportError: vi.fn() }));

const DOC = 'https://docs.test/a.erd.json';

function mount(search: string) {
  const view = render(
    createElement(EmbedViewer, { options: parseEmbedParams(search) })
  );
  return { ...view, viewer: lastViewer() };
}

/** The builder's preview of a URL, with the system language it hands over. */
function previewOf(search: string, systemLocale = 'fr-FR') {
  return createElement(EmbedViewer, {
    options: parseEmbedParams(search),
    preview: { systemLocale },
  });
}

function mountPreview(search: string, systemLocale?: string) {
  const view = render(previewOf(search, systemLocale));
  return { ...view, viewer: lastViewer() };
}

beforeAll(defineFakeErdViewer);

afterEach(() => {
  resetViewers();
  vi.mocked(reportError).mockClear();
});

describe('the embedded viewer', () => {
  it('has every option the URL names before its src, and its src before it joins the page', () => {
    const { viewer, unmount } = mount(
      `?src=${encodeURIComponent(DOC)}&theme=light&locale=ko-KR&name-view=logical` +
        '&minimap=false&controls=false&accent-color=crimson&gray-color=sand'
    );
    const src = viewer.indexOf('src', DOC);

    for (const name of [
      'setPresetTheme',
      'setLocale',
      'nameView',
      'minimap',
      'controls',
    ]) {
      expect(viewer.indexOf(name)).toBeGreaterThanOrEqual(0);
      expect(viewer.indexOf(name)).toBeLessThan(src);
    }
    expect(src).toBeLessThan(viewer.indexOf('connected'));
    expect(viewer.valuesOf('setPresetTheme')).toEqual([
      { appearance: 'light', accentColor: 'crimson', grayColor: 'sand' },
    ]);
    expect(viewer.valuesOf('setLocale')).toEqual(['ko-KR']);
    expect(viewer.props).toMatchObject({
      nameView: 'logical',
      minimap: false,
      controls: false,
    });
    unmount();
  });

  it("leaves the theme, the colors and the language to the viewer's own defaults when the URL names none", () => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(DOC)}`);

    expect(viewer.indexOf('setPresetTheme')).toBe(-1);
    expect(viewer.indexOf('setLocale')).toBe(-1);
    expect(viewer.indexOf('setSystemLocale')).toBe(-1);
    expect(viewer.indexOf('nameView')).toBe(-1);
    expect(viewer.props).toMatchObject({
      src: DOC,
      minimap: true,
      controls: true,
    });
    unmount();
  });

  it.each([
    'diagram.erd.json',
    'data:application/json,{}',
    ' https://docs.test/a b.erd.json',
    'HTTPS://Docs.test/a.erd.json',
    'https://github.com/o/r/tree/main/docs',
    'https://github.com/o/r/tree/main/my docs',
  ])('hands the viewer %j exactly as the query gives it', src => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(src)}`);

    expect(viewer.valuesOf('src')).toEqual([src]);
    unmount();
  });

  it('hands the viewer a value with spaces as the query decodes it', () => {
    const { viewer, unmount } = mount('?src=https://docs.test/a+b.erd.json');

    expect(viewer.valuesOf('src')).toEqual(['https://docs.test/a b.erd.json']);
    unmount();
  });

  it.each([
    [
      'https://github.com/o/r/blob/main/a.erd.json',
      'https://raw.githubusercontent.com/o/r/main/a.erd.json',
    ],
    [
      'https://gist.github.com/u/abc123',
      'https://gist.githubusercontent.com/u/abc123/raw',
    ],
  ])('fetches the GitHub page %j from its raw host', (src, raw) => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(src)}`);

    expect(viewer.valuesOf('src')).toEqual([raw]);
    expect(viewer.props.src).toBe(raw);
    unmount();
  });

  it('reports no error the viewer fires, which its own notice shows', () => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(DOC)}`);

    viewer.fire('error', new Error(`GET ${DOC} answered 404`));

    expect(reportError).not.toHaveBeenCalled();
    unmount();
  });

  it('takes the viewer out of the page, then destroys it, as it unmounts', () => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(DOC)}`);

    unmount();

    expect(viewer.indexOf('disconnected')).toBeGreaterThan(
      viewer.indexOf('connected')
    );
    expect(viewer.indexOf('destroy')).toBeGreaterThan(
      viewer.indexOf('disconnected')
    );
    expect(viewer.isConnected).toBe(false);
  });
});

describe("the builder's preview", () => {
  const DEFAULT_PRESET = {
    appearance: 'system',
    accentColor: 'indigo',
    grayColor: 'slate',
  };

  it('has the system language before the language, both before it joins the page, once each', () => {
    const { viewer, unmount } = mountPreview(`?src=${encodeURIComponent(DOC)}`);

    expect(viewer.valuesOf('setSystemLocale')).toEqual(['fr-FR']);
    expect(viewer.valuesOf('setLocale')).toEqual(['system']);
    expect(viewer.indexOf('setSystemLocale')).toBeLessThan(
      viewer.indexOf('setLocale')
    );
    expect(viewer.indexOf('setLocale')).toBeLessThan(viewer.indexOf('src'));
    expect(viewer.indexOf('src', DOC)).toBeLessThan(
      viewer.indexOf('connected')
    );
    expect(viewer.valuesOf('setPresetTheme')).toEqual([DEFAULT_PRESET]);
    unmount();
  });

  it('shows the language the options name', () => {
    const { viewer, unmount } = mountPreview(
      `?src=${encodeURIComponent(DOC)}&locale=ja-JP`
    );

    expect(viewer.valuesOf('setLocale')).toEqual(['ja-JP']);
    unmount();
  });

  it("puts the viewer's own defaults back on the same viewer when the options go back to them", () => {
    const { viewer, rerender, unmount } = mountPreview(
      `?src=${encodeURIComponent(DOC)}&theme=dark&name-view=logical` +
        '&accent-color=crimson&gray-color=sand'
    );

    rerender(previewOf(`?src=${encodeURIComponent(DOC)}`));

    expect(viewer.valuesOf('setPresetTheme')).toEqual([
      { appearance: 'dark', accentColor: 'crimson', grayColor: 'sand' },
      DEFAULT_PRESET,
    ]);
    expect(viewer.valuesOf('nameView')).toEqual(['logical', null]);
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    expect(FakeErdViewer.created).toHaveLength(1);
    unmount();
  });

  it('hands nothing again for the same options, and all of them for a new system language', () => {
    const search = `?src=${encodeURIComponent(DOC)}&minimap=false`;
    const { viewer, rerender, unmount } = mountPreview(search);

    rerender(previewOf(search));
    expect(viewer.valuesOf('minimap')).toEqual([false]);

    rerender(previewOf(search, 'de-DE'));
    expect(viewer.valuesOf('setSystemLocale')).toEqual(['fr-FR', 'de-DE']);
    expect(viewer.valuesOf('minimap')).toEqual([false, false]);
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    unmount();
  });

  it('fetches nothing without a src, and a GitHub file page from its raw host once one comes', () => {
    const { viewer, rerender, unmount } = mountPreview('');

    expect(viewer.indexOf('src')).toBe(-1);
    rerender(
      previewOf(
        `?src=${encodeURIComponent('https://github.com/o/r/blob/main/a.erd.json')}`
      )
    );

    expect(viewer.valuesOf('src')).toEqual([
      'https://raw.githubusercontent.com/o/r/main/a.erd.json',
    ]);
    expect(viewer.indexOf('value')).toBe(-1);
    unmount();
  });
});
