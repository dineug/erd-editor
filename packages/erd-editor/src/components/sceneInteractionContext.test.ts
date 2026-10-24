import { FC, html, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import {
  type SceneInteraction,
  sceneInteractionContext,
  useSceneInteraction,
} from '@/components/sceneInteractionContext';
import { useUnmounted } from '@/hooks/useUnmounted';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Reads the mode where it stands and prints it, as a move hook would read it. */
const Probe: FC<{ name: string }> = (props, ctx) => {
  const interaction = useSceneInteraction(ctx);

  return () =>
    html`<div
      class="probe"
      data-name=${props.name}
      data-interaction=${interaction.value}
    ></div>`;
};

/** A scene root that provides a mode inside a wrapper of its own, as a read-only one does. */
const Root: FC<{ interaction: SceneInteraction; children: any }> = (
  props,
  ctx
) => {
  const provider = useProvider(ctx, sceneInteractionContext, props.interaction);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => provider.destroy());

  return () => html`${props.children}`;
};

const Scope: FC<{ interaction: SceneInteraction; children: any }> =
  props => () =>
    html`<div class="scope">
      <${Root} interaction=${props.interaction} .children=${props.children} />
    </div>`;

const interactionOf = (name: string) =>
  mounted!.container
    .querySelector<HTMLElement>(`.probe[data-name="${name}"]`)!
    .getAttribute('data-interaction');

describe('sceneInteractionContext', () => {
  it('is edit where nothing provides a mode, as on the ERD tab and in a readonly editor', async () => {
    mounted = await mountAndFlush(html`<${Probe} name="alone" />`);

    expect(interactionOf('alone')).toBe('edit');
  });

  it('hands a wrapped scene read and leaves a sibling outside the wrapper on edit', async () => {
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction="read"
        .children=${html`<${Probe} name="inside" />`}
      />
      <${Probe} name="beside" />
    `);

    expect(interactionOf('inside')).toBe('read');
    expect(interactionOf('beside')).toBe('edit');
  });

  it('lets the nearest scene root win', async () => {
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction="read"
        .children=${html`
          <${Probe} name="read-leaf" />
          <${Scope}
            interaction="edit"
            .children=${html`<${Probe} name="edit-leaf" />`}
          />
        `}
      />
    `);

    expect(interactionOf('read-leaf')).toBe('read');
    expect(interactionOf('edit-leaf')).toBe('edit');
  });
});
