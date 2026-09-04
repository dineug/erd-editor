/** @jsxHost konva */

// AC-G2: the konva host needs no context system of its own. The adapter hands a
// component a ctx.host of stage.container(), a real element, so the CustomEvent
// useContext dispatches bubbles and composes out to the DOM shell's provider.

import {
  createContext,
  type DOMTemplateLiterals,
  type FC,
  observable,
  useContext,
  useProvider,
} from '@dineug/r-html';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import { whenDrawn } from '@/konva/batchDraw';
import { konvaAdapter, renderKonva } from '@/konva/host';

type ComponentCtx = Parameters<FC>[1];

/**
 * A second context carrying a string rather than the frozen AppContext object,
 * which r-html excludes from tracking on purpose. It is what lets the
 * re-provision below prove the subscription is live and not only answered once.
 */
const labelContext = createContext('unprovided', 'konva-di-label');

type Seen = {
  app: AppContext | null;
  ctx: ComponentCtx | null;
  label: string;
  renders: number;
};

type SceneProps = { seen: Seen };

const Leaf: FC<SceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const label = useContext(ctx, labelContext);

  return () => {
    props.seen.app = app.value;
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

const Trunk: FC<SceneProps> = props => () => (
  <k-group name={'trunk'}>
    <Branch seen={props.seen} />
  </k-group>
);

const scene = (seen: Seen) => (
  <k-layer name={'scene'}>
    <Trunk seen={seen} />
  </k-layer>
);

/**
 * The state the tear-down scene below reads. show is what removes the doomed
 * component and tick is what queues its re-render, and each is read by exactly
 * one of the two, so the write order is the order their jobs queue in.
 */
const doomed = observable({ show: true, tick: 0 }, { shallow: true });

type Torn = {
  childRenders: number;
  doomedRenders: number;
  sawDefault: boolean;
};

type TornProps = { seen: Torn };

const TornChild: FC<TornProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    props.seen.childRenders += 1;
    app.value === appContext.value && (props.seen.sawDefault = true);
    return <k-rect name={'torn-child'} width={2} height={2} />;
  };
};

/**
 * Two spellings of one component, so the re-render its removal races builds a
 * fresh child rather than recommitting the one it already has. That child is
 * the shape the relationship draw crashed on.
 */
const Doomed: FC<TornProps> = props => () => {
  props.seen.doomedRenders += 1;

  return doomed.tick === 0 ? (
    <k-group name={'doomed'}>
      <TornChild seen={props.seen} />
    </k-group>
  ) : (
    <k-group name={'doomed-again'}>
      <k-rect name={'extra'} width={1} height={1} />
      <TornChild seen={props.seen} />
    </k-group>
  );
};

const Shell: FC<TornProps> = props => () => (
  <k-group name={'shell'}>
    {doomed.show ? <Doomed seen={props.seen} /> : null}
  </k-group>
);

const tornScene = (seen: Torn) => (
  <k-layer name={'scene'}>
    <Shell seen={seen} />
  </k-layer>
);

const emptyTorn = (): Torn => ({
  childRenders: 0,
  doomedRenders: 0,
  sawDefault: false,
});

const emptySeen = (): Seen => ({
  app: null,
  ctx: null,
  label: '',
  renders: 0,
});

type Provider<T> = {
  set: (value: T) => void;
  destroy: () => void;
};

type Mounted = {
  app: AppContext;
  container: HTMLDivElement;
  labels: Provider<string>;
  seen: Seen;
  stage: Stage;
};

const teardowns: Array<() => void> = [];

function createStage(
  container: HTMLDivElement,
  template: DOMTemplateLiterals
): Stage {
  const stage = new Stage({ container, width: 100, height: 100 });

  teardowns.push(() => {
    renderKonva(stage, null);
    stage.destroy();
  });

  renderKonva(stage, template);
  return stage;
}

/**
 * A DOM shell with both providers on the outer element and the Stage container
 * under it. With a shadow root between the two, only a composed event reaches
 * them, which is the half of the claim bubbling alone cannot carry.
 */
async function mountScene(
  options: { shadow?: boolean } = {}
): Promise<Mounted> {
  const shell = document.createElement('div');
  document.body.append(shell);
  const root: ParentNode = options.shadow
    ? shell.attachShadow({ mode: 'open' })
    : shell;
  const container = document.createElement('div');
  root.append(container);

  const app = createTestAppContext();
  // useProvider takes a bare HTMLElement at runtime but types only a component
  // context, hence the casts; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider: Provider<AppContext> = useProvider(
    shell as any,
    appContext,
    app
  );
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const labels: Provider<string> = useProvider(
    shell as any,
    labelContext,
    'provided'
  );
  const seen = emptySeen();
  const stage = createStage(container, scene(seen));

  teardowns.push(() => {
    labels.destroy();
    provider.destroy();
    shell.remove();
  });

  await flush();
  await whenDrawn();

  return { app, container, labels, seen, stage };
}

/**
 * The same shell, rendering the tear-down scene instead. The providers sit on
 * the outer element exactly as above, so a component that resolves the default
 * here did so because it could not reach them, not because none were installed.
 */
async function mountTorn(): Promise<{ app: AppContext; seen: Torn }> {
  const shell = document.createElement('div');
  document.body.append(shell);
  const container = document.createElement('div');
  shell.append(container);

  const app = createTestAppContext();
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider: Provider<AppContext> = useProvider(
    shell as any,
    appContext,
    app
  );
  const seen = emptyTorn();

  doomed.show = true;
  doomed.tick = 0;
  createStage(container, tornScene(seen));

  teardowns.push(() => {
    provider.destroy();
    shell.remove();
  });

  await flush();
  await whenDrawn();

  return { app, seen };
}

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

describe('the konva scene resolves DI through the DOM shell (AC-G2)', () => {
  it('answers a component three deep with the shell provider value', async () => {
    const { app, seen, stage } = await mountScene();

    expect(stage.findOne('.leaf')).toBeTruthy();
    expect(seen.app).toBe(app);
    expect(seen.app).not.toBe(appContext.value);
    expect(seen.label).toBe('provided');
  });

  it('targets the stage container, which is what makes the event travel', async () => {
    const { container, seen } = await mountScene();

    expect(seen.ctx?.host).toBe(container);
    expect(seen.ctx?.parentElement).toBeNull();
  });

  it('crosses a shadow boundary to a provider outside it', async () => {
    const { app, seen } = await mountScene({ shadow: true });

    expect(seen.app).toBe(app);
    expect(seen.label).toBe('provided');
  });

  it('keeps the subscription, so a later value reaches the same component', async () => {
    const { labels, seen } = await mountScene();
    const before = seen.renders;

    labels.set('reprovided');
    await flush();
    await whenDrawn();

    expect(seen.label).toBe('reprovided');
    expect(seen.renders).toBeGreaterThan(before);
  });

  it('falls back to the context default with no provider above it', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const seen = emptySeen();

    teardowns.push(() => container.remove());
    createStage(container, scene(seen));
    await flush();
    await whenDrawn();

    expect(seen.label).toBe('unprovided');
    expect(seen.app).toBe(appContext.value);
  });
});

describe('a konva context follows its node into the Stage (AC-G2)', () => {
  it('answers the container once a detached node is spliced under the Stage', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const stage = new Stage({ container, width: 20, height: 20 });
    const layer = new Layer();

    teardowns.push(() => {
      stage.destroy();
      container.remove();
    });

    konvaAdapter.appendChild(stage, layer);

    const group = konvaAdapter.createElement('k-group');
    const marker = konvaAdapter.createMarker('');
    konvaAdapter.appendChild(group, marker);

    const ctx = konvaAdapter.createComponentContext(
      marker,
      konvaAdapter.createEventBus()
    );

    expect(ctx.host).not.toBe(container);

    konvaAdapter.appendChild(layer, group);

    expect(ctx.host).toBe(container);
    expect(ctx.parentElement).toBeNull();

    await whenDrawn();
  });
});

describe('a torn down konva component never renders again', () => {
  it('drops the queued re-render, so no child resolves the unprovided default', async () => {
    const { seen } = await mountTorn();

    expect(seen.doomedRenders).toBeGreaterThan(0);
    expect(seen.childRenders).toBeGreaterThan(0);
    expect(seen.sawDefault).toBe(false);

    const doomedRenders = seen.doomedRenders;
    const childRenders = seen.childRenders;

    doomed.show = false;
    doomed.tick = 1;
    await flush();
    await whenDrawn();

    expect(seen.sawDefault).toBe(false);
    expect(seen.doomedRenders).toBe(doomedRenders);
    expect(seen.childRenders).toBe(childRenders);
  });
});
