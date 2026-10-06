/** @jsxHost konva */

import { type FC } from '@dineug/r-html';
import { Konva } from 'konva/lib/Global';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  moveScenePointer,
  provideI18n,
  pseudoMessages,
  whenPainted,
} from '@/__test-utils__';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import { themeContext, useThemeContext } from '@/components/themeContext';
import { sourceI18n } from '@/i18n/source';
import { createI18n, type I18n } from '@/i18n/translate';
import { whenDrawn } from '@/konva/batchDraw';
import { type RenderedScene, renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

type ComponentCtx = Parameters<FC>[1];

type Seen = {
  first: AppContext | null;
  last: AppContext | null;
  theme: Theme | null;
  ctx: ComponentCtx | null;
  renders: number;
};

type SceneProps = { seen: Seen };

const Leaf: FC<SceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const theme = useThemeContext(ctx);

  return () => {
    props.seen.renders += 1;
    props.seen.last = app.value;
    props.seen.first ??= app.value;
    props.seen.theme = theme.value;
    props.seen.ctx = ctx;
    return <k-rect name="leaf" width={4} height={4} fill={theme.value.focus} />;
  };
};

const Trunk: FC<SceneProps> = props => () => (
  <k-group name="trunk">
    <Leaf seen={props.seen} />
  </k-group>
);

const sceneOf = (seen: Seen) => (
  <k-layer name="scene">
    <Trunk seen={seen} />
  </k-layer>
);

const emptySeen = (): Seen => ({
  first: null,
  last: null,
  theme: null,
  ctx: null,
  renders: 0,
});

const teardowns: Array<() => void> = [];

type Mounted = {
  app: AppContext;
  container: HTMLDivElement;
  scene: RenderedScene;
  seen: Seen;
};

function mountScene(theme?: Theme): Mounted {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createTestAppContext();
  const seen = emptySeen();
  const rendered = renderScene({
    app,
    container,
    scene: sceneOf(seen),
    width: 320,
    height: 240,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  return { app, container, scene: rendered, seen };
}

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

describe('renderScene builds one Stage for a scene to be drawn into', () => {
  it('returns a Stage of the size it was asked for', async () => {
    const { scene } = mountScene();
    await flush();
    await whenDrawn();

    expect(scene.stage.width()).toBe(320);
    expect(scene.stage.height()).toBe(240);
    expect(scene.stage.findOne('.leaf')).toBeTruthy();
  });

  it('answers the first render with the app it was given (G1-worker)', async () => {
    const { app, seen } = mountScene();
    await flush();
    await whenDrawn();

    expect(seen.renders).toBeGreaterThan(0);
    expect(seen.first).toBe(app);
    expect(seen.last).toBe(app);
    expect(seen.first).not.toBe(appContext.value);
  });

  it('paints a scene node from the theme it was given', async () => {
    const theme = createTestTheme();
    const { scene, seen } = mountScene(theme);
    await flush();
    await whenDrawn();

    expect(seen.theme).toBe(theme);
    expect(scene.stage.findOne('.leaf')?.getAttr('fill')).toBe(theme.focus);
  });

  it('leaves the theme to an ancestor when it was given none', async () => {
    const { seen } = mountScene();
    await flush();
    await whenDrawn();

    expect(seen.theme).toBe(themeContext.value);
  });

  it('provides on the target the host resolves a component to', async () => {
    const { container, seen } = mountScene();
    await flush();
    await whenDrawn();

    expect(seen.ctx?.host).toBe(container);
    expect(seen.ctx?.parentElement).toBeNull();
  });

  it('empties the Stage and drops the provider when destroyed', async () => {
    const { app, container, scene, seen } = mountScene();
    await flush();
    await whenDrawn();

    scene.destroy();
    await whenDrawn();

    expect(scene.stage.getChildren()).toHaveLength(0);

    const after = emptySeen();
    const second = renderScene({
      app,
      container,
      scene: sceneOf(after),
      width: 320,
      height: 240,
    });
    teardowns.push(() => second.destroy());
    await flush();
    await whenDrawn();

    expect(seen.renders).toBeGreaterThan(0);
    expect(after.first).toBe(app);
  });
});

type Said = { i18n: I18n | null; text: string };

/** A scene node that writes one of the editor's own words, as a placeholder does. */
const Word: FC<{ said: Said }> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => {
    props.said.i18n = i18n.value;
    props.said.text = i18n.value.t('common.placeholder.table');
    return <k-text name="word" text={props.said.text} />;
  };
};

function mountWord(i18n?: I18n, container = document.createElement('div')) {
  container.isConnected || document.body.append(container);
  const said: Said = { i18n: null, text: '' };
  const rendered = renderScene({
    app: createTestAppContext(),
    container,
    scene: (
      <k-layer name="scene">
        <Word said={said} />
      </k-layer>
    ),
    width: 320,
    height: 240,
    i18n,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  return { said, scene: rendered };
}

describe('renderScene draws the scene in the language it is given', () => {
  it('writes a word in the language it was given', async () => {
    const i18n = createI18n('ja-JP', pseudoMessages('ja'));
    const { said, scene } = mountWord(i18n);
    await flush();
    await whenDrawn();

    expect(said.i18n).toBe(i18n);
    expect(scene.stage.findOne('.word')?.getAttr('text')).toBe('ja:table');
  });

  it('writes it in English where nothing provides a language', async () => {
    const { said } = mountWord();
    await flush();
    await whenDrawn();

    expect(said.i18n).toBe(sourceI18n);
    expect(said.text).toBe('table');
  });

  it('leaves the language to a DOM ancestor when it was given none', async () => {
    const outer = document.createElement('div');
    const container = document.createElement('div');
    outer.append(container);
    document.body.append(outer);
    const i18n = createTestI18n('ko-KR', pseudoMessages('ko'));
    const provider = provideI18n(outer, i18n);
    teardowns.push(() => {
      provider.destroy();
      outer.remove();
    });

    const { said } = mountWord(undefined, container);
    await flush();
    await whenDrawn();

    expect(said.text).toBe('ko:table');
  });

  it('drops the language with the rest of the scene when destroyed', async () => {
    const container = document.createElement('div');
    const { scene } = mountWord(
      createI18n('de-DE', pseudoMessages('de')),
      container
    );
    await flush();
    await whenDrawn();

    scene.destroy();
    const { said } = mountWord(undefined, container);
    await flush();
    await whenDrawn();

    expect(said.text).toBe('table');
  });
});

/**
 * The half of konva a konva/lib import graph has to stand in for. Konva reads
 * its own registry on every Stage pointer event, and only its barrel fills that
 * registry in, so a missing entry throws before any listener is reached.
 */
describe('a Stage renderScene builds dispatches konva pointer events', () => {
  it('answers the drag question its pointer handlers ask', () => {
    expect(Konva.isDragging()).toBe(false);
  });

  it('turns a content mousemove into an enter on the shape under it', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const entered: string[] = [];

    const rendered = renderScene({
      app: createTestAppContext(),
      container,
      width: 320,
      height: 240,
      theme: createTestTheme(),
      scene: (
        <k-layer name="scene">
          <k-rect
            name="target"
            x={20}
            y={20}
            width={80}
            height={40}
            fill="#123456"
            on:mouseenter={() => entered.push('target')}
          />
        </k-layer>
      ),
    });
    teardowns.push(() => {
      rendered.destroy();
      container.remove();
    });

    await flush();
    await whenDrawn();
    await whenPainted();

    moveScenePointer(rendered.stage, 60, 40);

    expect(entered).toEqual(['target']);
  });
});
