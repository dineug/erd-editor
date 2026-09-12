import { FC, html, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import {
  sceneSourceContext,
  useSceneSource,
} from '@/components/sceneSourceContext';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Reads the source where it stands and prints it, so the DOM says what a scene leaf would get. */
const Probe: FC<{ name: string }> = (props, ctx) => {
  const source = useSceneSource(ctx);

  return () =>
    html`<div
      class="probe"
      data-name=${props.name}
      data-source=${source.value}
    ></div>`;
};

/**
 * Provides on the element it is mounted under, which is what useProvider does
 * for any component: the listener hangs on the parent, never on the component.
 */
const Root: FC<{ source: GeometrySource; children: any }> = (props, ctx) => {
  const provider = useProvider(ctx, sceneSourceContext, props.source);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => provider.destroy());

  return () => html`${props.children}`;
};

/** A scene root the way the plan mounts one: a wrapper of its own, the provider inside it. */
const Scope: FC<{ source: GeometrySource; children: any }> = props => () =>
  html`<div class="scope" data-source=${props.source}>
    <${Root} source=${props.source} .children=${props.children} />
  </div>`;

const sourceOf = (name: string) =>
  mounted!.container
    .querySelector<HTMLElement>(`.probe[data-name="${name}"]`)!
    .getAttribute('data-source');

describe('sceneSourceContext', () => {
  it('is the document where nothing provides a source', async () => {
    mounted = await mountAndFlush(html`<${Probe} name="alone" />`);

    expect(sourceOf('alone')).toBe('document');
  });

  it('hands a wrapped scene its source and leaves a sibling outside the wrapper the document', async () => {
    mounted = await mountAndFlush(html`
      <${Scope} source="flow" .children=${html`<${Probe} name="inside" />`} />
      <${Probe} name="beside" />
    `);

    expect(sourceOf('inside')).toBe('flow');
    expect(sourceOf('beside')).toBe('document');
  });

  it('lets the nearest scene root win, so a document opened over a view stays the document', async () => {
    mounted = await mountAndFlush(html`
      <${Scope}
        source="flow"
        .children=${html`
          <${Probe} name="view-leaf" />
          <${Scope}
            source="document"
            .children=${html`<${Probe} name="document-leaf" />`}
          />
        `}
      />
    `);

    expect(sourceOf('view-leaf')).toBe('flow');
    expect(sourceOf('document-leaf')).toBe('document');
  });

  /**
   * The reason every root provides inside a wrapper of its own: a provider hung
   * straight on a shared parent reaches everything under that parent, the
   * toolbar and the other overlays included.
   */
  it('reaches every child of the parent it hangs on when mounted without a wrapper', async () => {
    mounted = await mountAndFlush(html`
      <${Root} source="flow" .children=${html`<${Probe} name="own" />`} />
      <${Probe} name="neighbour" />
    `);

    expect(sourceOf('own')).toBe('flow');
    expect(sourceOf('neighbour')).toBe('flow');
  });
});
