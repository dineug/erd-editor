import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import * as styles from '@/components/primitives/highlighted-text/HighlightedText.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const highlights = () =>
  Array.from(mounted!.container.querySelectorAll('span')).map(
    span => span.textContent
  );

describe('HighlightedText', () => {
  it('wraps every match in a span carrying the highlight class', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['the']}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    const spans = Array.from(mounted.container.querySelectorAll('span'));
    expect(spans).toHaveLength(2);
    for (const span of spans) {
      expect(span.classList.contains(String(styles.highlighted))).toBe(true);
      expect(span.textContent).toBe('the');
    }
  });

  it('renders the untouched chunks as plain text so the full string survives', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['the']}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    expect(mounted.container.textContent).toBe('the dog and the cat');
  });

  it('matches case insensitively by default', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['the']}
        textToHighlight=${'The dog and the cat'}
      />`
    );

    expect(highlights()).toEqual(['The', 'the']);
  });

  it('honours caseSensitive when it is passed through', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['the']}
        textToHighlight=${'The dog and the cat'}
        caseSensitive=${true}
      />`
    );

    expect(highlights()).toEqual(['the']);
    expect(mounted.container.textContent).toBe('The dog and the cat');
  });

  it('highlights each of several search words', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['dog', 'cat']}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    expect(highlights()).toEqual(['dog', 'cat']);
  });

  it('matches a word as typed, never as a regular expression', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['a.c']}
        textToHighlight=${'abc a.c'}
      />`
    );

    expect(highlights()).toEqual(['a.c']);
    expect(mounted.container.textContent).toBe('abc a.c');
  });

  it('lights words that touch or overlap in one span', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['dog', ' and', 'he c', 'cat']}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    expect(highlights()).toEqual(['dog and', 'he cat']);
    expect(mounted.container.textContent).toBe('the dog and the cat');
  });

  it('lights what its findChunks finds, merged and in order', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['zebra']}
        textToHighlight=${'the dog and the cat'}
        findChunks=${() => [
          { start: 16, end: 19 },
          { start: 4, end: 6 },
          { start: 5, end: 7 },
        ]}
      />`
    );

    expect(highlights()).toEqual(['dog', 'cat']);
    expect(mounted.container.textContent).toBe('the dog and the cat');
  });

  it('renders the text unhighlighted when nothing matches', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${['zebra']}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    expect(mounted.container.querySelectorAll('span')).toHaveLength(0);
    expect(mounted.container.textContent).toBe('the dog and the cat');
  });

  it('renders the whole text unhighlighted when there are no search words', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText}
        searchWords=${[]}
        textToHighlight=${'the dog and the cat'}
      />`
    );

    expect(mounted.container.querySelectorAll('span')).toHaveLength(0);
    expect(mounted.container.textContent).toBe('the dog and the cat');
  });

  it('renders nothing for an empty text', async () => {
    mounted = await mountAndFlush(
      html`<${HighlightedText} searchWords=${['the']} textToHighlight=${''} />`
    );

    expect(mounted.container.textContent).toBe('');
  });
});
