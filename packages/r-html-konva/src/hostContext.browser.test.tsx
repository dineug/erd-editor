/** @jsxHost konva */

// The host needs no context system of its own. A component's ctx.host is the
// Stage container, a real element, so the event useContext dispatches bubbles
// out to a DOM provider above the canvas, and a parked fragment borrows a root.

import {
  createContext,
  type DOMTemplateLiterals,
  type FC,
  nextTick,
  useContext,
  useProvider,
} from '@dineug/r-html';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { whenDrawn } from '@/batchDraw';
import { konva, konvaAdapter, renderKonva } from '@/host';

type ComponentCtx = Parameters<FC>[1];

const labelContext = createContext('unprovided', 'konva-host-label');

type Seen = {
  ctx: ComponentCtx | null;
  label: string;
  renders: number;
};

type SceneProps = { seen: Seen };

const emptySeen = (): Seen => ({ ctx: null, label: '', renders: 0 });

const Leaf: FC<SceneProps> = (props, ctx) => {
  const label = useContext(ctx, labelContext);

  return () => {
    props.seen.ctx = ctx;
    props.seen.label = label.value;
    props.seen.renders += 1;
    return <k-rect name={'leaf'} width={2} height={2} />;
  };
};

const Branch: FC<SceneProps> = props => () => (
  <k-group name={'branch'}>
    <Leaf seen={props.seen} />
  </k-group>
);

const scene = (seen: Seen) => (
  <k-layer name={'scene'}>
    <k-group name={'trunk'}>
      <Branch seen={seen} />
    </k-group>
  </k-layer>
);

type Provider = {
  set: (value: string) => void;
  destroy: () => void;
};

/**
 * useProvider takes a bare HTMLElement at runtime but types only a component
 * context, hence the cast; it is r-html's, not a React hook.
 */
function provideLabel(shell: HTMLElement): Provider {
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  return useProvider(shell as any, labelContext, 'provided');
}

const teardowns: Array<() => void> = [];

/** Let the r-html scheduler and the microtasks it queues drain. */
async function flush(ticks = 3) {
  for (let i = 0; i < ticks; i++) {
    await nextTick(() => {});
    await Promise.resolve();
  }
}

function createStage(container: HTMLDivElement): Stage {
  const stage = new Stage({ container, width: 100, height: 100 });

  teardowns.push(() => {
    renderKonva(stage, null);
    stage.destroy();
  });

  return stage;
}

/**
 * A DOM shell with the provider on the outer element and the Stage container
 * under it. With a shadow root between the two, only a composed event reaches
 * the provider, which is the half of the claim bubbling alone cannot carry.
 */
async function mountScene(
  template: (seen: Seen) => DOMTemplateLiterals,
  options: { provide?: boolean; shadow?: boolean } = {}
) {
  const shell = document.createElement('div');
  document.body.append(shell);
  const root: ParentNode = options.shadow
    ? shell.attachShadow({ mode: 'open' })
    : shell;
  const container = document.createElement('div');
  root.append(container);

  const labels = options.provide === false ? null : provideLabel(shell);
  const seen = emptySeen();
  const stage = createStage(container);

  teardowns.push(() => {
    labels?.destroy();
    shell.remove();
  });

  renderKonva(stage, template(seen));
  await flush();
  await whenDrawn();

  return { container, labels, seen, stage };
}

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
  vi.restoreAllMocks();
});

describe('a konva scene resolves DI through the DOM shell (AC-G2)', () => {
  it('answers a component three deep with the provider value', async () => {
    const { seen, stage } = await mountScene(scene);

    expect(stage.findOne('.leaf')).toBeTruthy();
    expect(seen.label).toBe('provided');
  });

  it('targets the stage container, which is what makes the event travel', async () => {
    const { container, seen } = await mountScene(scene);

    expect(seen.ctx?.host).toBe(container);
    expect(seen.ctx?.parentElement).toBeNull();
  });

  it('crosses a shadow boundary to a provider outside it', async () => {
    const { seen } = await mountScene(scene, { shadow: true });

    expect(seen.label).toBe('provided');
  });

  it('keeps the subscription, so a later value reaches the same component', async () => {
    const { labels, seen } = await mountScene(scene);
    const before = seen.renders;

    labels?.set('reprovided');
    await flush();
    await whenDrawn();

    expect(seen.label).toBe('reprovided');
    expect(seen.renders).toBeGreaterThan(before);
  });

  it('falls back to the context default with no provider above it', async () => {
    const { seen } = await mountScene(scene, { provide: false });

    expect(seen.label).toBe('unprovided');
  });
});

describe('a component event travels on its own bus', () => {
  it('reaches the handler its parent bound, and leaves with the scene', async () => {
    const handler = vi.fn();
    let fire: () => boolean = () => false;
    const Emitter: FC = (_props, ctx) => {
      fire = () => ctx.dispatchEvent(new CustomEvent('ping', { detail: 7 }));
      return () => konva`<k-rect name=${'emitter'}></k-rect>`;
    };
    const { stage } = await mountScene(
      () => konva`<k-layer><${Emitter} @ping=${handler} /></k-layer>`
    );

    expect(fire()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toBe(7);

    renderKonva(stage, null);
    await whenDrawn();
    fire();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('a konva context follows its node into the Stage (AC-G2)', () => {
  it('answers the bus while detached and the container once spliced in', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const stage = createStage(container);
    const layer = new Layer();
    const bus = konvaAdapter.createEventBus();

    teardowns.push(() => container.remove());
    konvaAdapter.appendChild(stage, layer);

    const group = konvaAdapter.createElement('k-group');
    const marker = konvaAdapter.createMarker('');
    konvaAdapter.appendChild(group, marker);

    const ctx = konvaAdapter.createComponentContext(marker, bus);

    expect(ctx.host).toBe(bus);

    konvaAdapter.appendChild(layer, group);

    expect(ctx.host).toBe(container);
    expect(ctx.parentElement).toBeNull();

    await whenDrawn();
  });

  it('lends a parked fragment its bridged root until the bridge is torn down', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const stage = createStage(container);
    const bus = konvaAdapter.createEventBus();

    teardowns.push(() => container.remove());

    const fragment = konvaAdapter.createFragment();
    const parked = konvaAdapter.createElement('k-group');
    konvaAdapter.appendChild(fragment, parked);
    const ctx = konvaAdapter.createComponentContext(parked, bus);

    expect(konvaAdapter.getRoot(parked)).toBe(fragment);

    const unbridge = konvaAdapter.bridgeFragment(fragment, stage);

    expect(konvaAdapter.getRoot(parked)).toBe(stage);
    expect(ctx.host).toBe(container);

    unbridge();

    expect(konvaAdapter.getRoot(parked)).toBe(fragment);
    expect(ctx.host).toBe(bus);

    await whenDrawn();
  });
});
