import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdViewer,
  lastViewer,
  resetViewers,
} from '@/__test-utils__/erdViewer';
import { render } from '@/__test-utils__/render';
import EmbedViewer from '@/components/embed/embed-viewer/EmbedViewer';
import { parseEmbedParams } from '@/utils/embedOptions';
import { toGithubRawUrl } from '@/utils/githubRawUrl';
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
    'https://github.com/o/r/tree/main/docs',
    'https://github.com/o/r/blob/main/a.erd.json',
    'https://gist.github.com/u/abc123',
  ])('hands the viewer %j as the GitHub mapping leaves it', src => {
    const { viewer, unmount } = mount(`?src=${encodeURIComponent(src)}`);
    const given = new URLSearchParams(`?src=${encodeURIComponent(src)}`).get(
      'src'
    );

    expect(viewer.valuesOf('src')).toEqual([toGithubRawUrl(given ?? '')]);
    unmount();
  });

  it('fetches a GitHub file page from its raw host', () => {
    const { viewer, unmount } = mount(
      `?src=${encodeURIComponent('https://github.com/o/r/blob/main/a.erd.json')}`
    );

    expect(viewer.props.src).toBe(
      'https://raw.githubusercontent.com/o/r/main/a.erd.json'
    );
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
