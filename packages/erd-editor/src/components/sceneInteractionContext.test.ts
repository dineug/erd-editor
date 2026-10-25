import { FC, html, observable, useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import {
  type SceneInteraction,
  sceneInteractionContext,
  type SceneInteractionValue,
  useSceneInteraction,
} from '@/components/sceneInteractionContext';
import { useUnmounted } from '@/hooks/useUnmounted';

let mounted: Mounted | null = null;

/** The getter each probe was handed, by its name, for a spec to call as a handler would. */
const getters = new Map<string, () => SceneInteraction>();

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  getters.clear();
});

/** Reads the mode where it stands and prints it, as a move hook would read it. */
const Probe: FC<{ name: string }> = (props, ctx) => {
  const interaction = useSceneInteraction(ctx);
  getters.set(props.name, interaction);

  return () =>
    html`<div
      class="probe"
      data-name=${props.name}
      data-interaction=${interaction()}
    ></div>`;
};

/** A scene root that provides a mode inside a wrapper of its own, as a read-only one does. */
const Root: FC<{ interaction: SceneInteractionValue; children: any }> = (
  props,
  ctx
) => {
  const provider = useProvider(ctx, sceneInteractionContext, props.interaction);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => provider.destroy());

  return () => html`${props.children}`;
};

const Scope: FC<{ interaction: SceneInteractionValue; children: any }> =
  props => () =>
    html`<div class="scope">
      <${Root} interaction=${props.interaction} .children=${props.children} />
    </div>`;

const interactionOf = (name: string) =>
  mounted!.container
    .querySelector<HTMLElement>(`.probe[data-name="${name}"]`)!
    .getAttribute('data-interaction');

describe('sceneInteractionContext', () => {
  it('is edit where nothing provides a mode', async () => {
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

describe('sceneInteractionContext under a getter', () => {
  /** A mode a root reads off something that changes, as an editor reads its readonly flag. */
  const createSource = (mode: SceneInteraction) => {
    const source = observable({ mode, late: false });
    return { source, getter: () => source.mode };
  };

  /** A scene that mounts its probe only once the source says so, after the root provided. */
  const lateLeaf = (source: { late: boolean }) => {
    const Late: FC<{}> = () => () =>
      source.late ? html`<${Probe} name="late" />` : null;
    return html`<${Late} />`;
  };

  it('hands a wrapped scene the mode the getter reads', async () => {
    const { getter } = createSource('read');
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction=${getter}
        .children=${html`<${Probe} name="inside" />`}
      />
      <${Probe} name="beside" />
    `);

    expect(interactionOf('inside')).toBe('read');
    expect(interactionOf('beside')).toBe('edit');
  });

  it('hands a takeover inside a readonly editor the edit its own root provides again', async () => {
    const { getter } = createSource('read');
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction=${getter}
        .children=${html`
          <${Probe} name="erd" />
          <${Scope}
            interaction="edit"
            .children=${html`<${Probe} name="takeover" />`}
          />
        `}
      />
    `);

    expect(interactionOf('erd')).toBe('read');
    expect(interactionOf('takeover')).toBe('edit');
  });

  it('draws a mounted scene again when what the getter reads changes', async () => {
    const { source, getter } = createSource('edit');
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction=${getter}
        .children=${html`<${Probe} name="inside" />`}
      />
    `);
    expect(interactionOf('inside')).toBe('edit');

    source.mode = 'read';
    await flush();
    expect(interactionOf('inside')).toBe('read');

    source.mode = 'edit';
    await flush();
    expect(interactionOf('inside')).toBe('edit');
  });

  it('reads the mode in force when called, as a handler does, before anything draws again', async () => {
    const { source, getter } = createSource('edit');
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction=${getter}
        .children=${html`<${Probe} name="inside" />`}
      />
    `);
    const interaction = getters.get('inside')!;

    source.mode = 'read';

    expect(interaction()).toBe('read');
    expect(interactionOf('inside')).toBe('edit');
  });

  it('hands a scene that subscribes after the change the mode in force, not the first one', async () => {
    const { source, getter } = createSource('edit');
    mounted = await mountAndFlush(html`
      <${Scope}
        interaction=${getter}
        .children=${html`<${Probe} name="early" /> ${lateLeaf(source)}`}
      />
    `);

    source.mode = 'read';
    await flush();
    source.late = true;
    await flush();

    expect(interactionOf('late')).toBe('read');
    expect(getters.get('late')!()).toBe('read');
    expect(interactionOf('early')).toBe('read');
  });
});
