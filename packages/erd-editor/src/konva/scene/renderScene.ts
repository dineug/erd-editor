import { type DOMTemplateLiterals, useProvider } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';

import { type AppContext, appContext } from '@/components/appContext';
import { trackSceneHits } from '@/components/erd/hitTest';
import { localeContext } from '@/components/localeContext';
import { themeContext } from '@/components/themeContext';
import type { I18n } from '@/i18n/translate';
import { renderKonva } from '@/konva/host';
import type { Theme } from '@/themes/tokens';

/**
 * What konva accepts as a Stage container. Read off the constructor so this
 * module names no DOM type of its own, which is what lets it be imported in a
 * realm that has none.
 */
type StageContainer = NonNullable<
  ConstructorParameters<typeof Stage>[0]['container']
>;

export type RenderSceneOptions = {
  app: AppContext;
  container: StageContainer;
  scene: DOMTemplateLiterals;
  width: number;
  height: number;
  /**
   * The palette to install for this Stage. Left out, the scene resolves the
   * theme through whatever DOM ancestor the container hangs under, which is
   * what an editor's own canvas wants and what a realm without one has none of.
   */
  theme?: Theme;
  /**
   * The language the scene's own words are drawn in. Left out, it is the one a
   * DOM ancestor of the container provides, or English where none does.
   */
  i18n?: I18n;
};

export type RenderedScene = {
  stage: Stage;
  destroy: () => void;
};

/**
 * One Stage, one scene, and the providers it is given, each up before the render
 * since a component resolves its context on its first pass, and each on what the
 * host resolves to, so a provider and its consumers meet on one object.
 */
export function renderScene({
  app,
  container,
  scene,
  width,
  height,
  theme,
  i18n,
}: RenderSceneOptions): RenderedScene {
  const stage = new Stage({ container, width, height });
  // The adapter hands a component this same target, and useProvider types only
  // a component context while taking a bare one at runtime, hence the cast.
  const target = { host: stage.container(), parentElement: null } as any;
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(target, appContext, app);
  const themeProvider = theme
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(target, themeContext, theme)
    : null;
  const localeProvider = i18n
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(target, localeContext, i18n)
    : null;

  const untrack = trackSceneHits(stage);

  renderKonva(stage, scene);

  return {
    stage,
    destroy: () => {
      untrack();
      renderKonva(stage, null);
      localeProvider?.destroy();
      themeProvider?.destroy();
      appProvider.destroy();
      stage.destroy();
    },
  };
}
