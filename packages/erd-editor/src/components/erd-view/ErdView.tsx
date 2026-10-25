import {
  createRef,
  FC,
  onMounted,
  type Ref,
  ref,
  useProvider,
} from '@dineug/r-html';

import {
  type AppContext,
  appContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import { stopTransitions } from '@/components/erd/canvas/highlightTransition';
import {
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import { listenSceneHover } from '@/components/erd/hitTest';
import Minimap from '@/components/erd/minimap/Minimap';
import { dropRelationshipHighlight } from '@/components/erd/relationshipHighlight';
import { useNameViewDropdown } from '@/components/erd/view-controls/nameViewDropdown';
import { toolbarCompass } from '@/components/erd/view-controls/ToolbarCompass.template';
import * as controls from '@/components/erd/view-controls/viewControls.styles';
import { useZoomControls } from '@/components/erd/view-controls/zoomControls';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { createTableActions } from '@/components/quick-search/documentSearch';
import QuickSearch from '@/components/quick-search/QuickSearch';
import { sceneInteractionContext } from '@/components/sceneInteractionContext';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { Open } from '@/constants/open';
import { WHEEL_ZOOM_STEP } from '@/constants/zoom';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useUnmounted } from '@/hooks/useUnmounted';
import { useViewShortcut } from '@/hooks/useViewShortcut';
import { hasContent } from '@/konva/scene/contentBounds';
import { fitDocument } from '@/konva/scene/fitZoom';
import { isMod } from '@/utils/keyboard-shortcut';
import { createText } from '@/utils/text';

import * as styles from './ErdView.styles';
import { createViewPress } from './pressHandler';
import { measureViewport } from './viewportMeasure';

export type ErdViewProps = {
  /**
   * Handed the view's own app as the view builds it, and null once it is gone,
   * for the host that loads the document into it and reads it back.
   */
  appRef?: Ref<AppContext | null>;
};

const ICON_SIZE = 16;

/**
 * The read-only scene root: a document drawn in a store of its own, which a
 * press pans and lights and nothing edits, with its scrollbars, its map, the
 * view controls and a palette that searches the document alone.
 */
const ErdView: FC<ErdViewProps> = (props, ctx) => {
  const text = createText();
  const app = createAppContext(
    { toWidth: text.toWidth },
    { getReadonly: () => true }
  );
  // A host hands the document over before the view is measured, and a load
  // pulled against the store's default size would land on a screen nobody has.
  app.store.dispatchSync(changeViewportAction({ width: 0, height: 0 }));

  const appProvider = useProvider(ctx, appContext, app);
  const sourceProvider = useProvider(ctx, sceneSourceContext, 'document');
  const interactionProvider = useProvider(ctx, sceneInteractionContext, 'read');
  const i18n = useI18n(ctx);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  useKeyBindingMap(ctx, root);
  useViewShortcut(ctx);
  const zoom = useZoomControls(ctx);
  const nameView = useNameViewDropdown(ctx);

  /** Whether the view holds the focus, which a click, a tap or the Tab key gives it. */
  const isActive = () => Boolean(root.value?.matches(':focus-within'));

  /** Whether the palette is open, whose backdrop and list lie over the whole view. */
  const isSearching = () =>
    Boolean(app.store.state.editor.openMap[Open.search]);

  const pinch = usePinchZoom({
    app: () => app,
    root,
    enabled: () => !isSearching(),
    interactive: isActive,
  });
  const press = createViewPress({
    app,
    root,
    canvas,
    pinches: pinch.handleTouchstart,
  });

  if (props.appRef) props.appRef.value = app;

  addUnsubscribe(() => {
    const { id } = app.store.state.editor;

    press.destroy();
    stopTransitions(id);
    dropRelationshipHighlight(id);
    appDestroy(app);
    interactionProvider.destroy();
    sourceProvider.destroy();
    appProvider.destroy();
    if (props.appRef?.value === app) props.appRef.value = null;
  });

  /**
   * The editor's wheel rule while the view holds the focus, and the page's
   * wheel before that and under the palette, whose list scrolls on its own.
   * A mod wheel zooms, a plain one pans, Shift across.
   */
  const handleWheel = (event: WheelEvent) => {
    if (pinch.handleWheel(event) || !isActive() || isSearching()) return;
    event.preventDefault();

    const isReverse =
      event.shiftKey && event.deltaX === 0 && event.deltaY !== 0;

    app.store.dispatch(
      isMod(event)
        ? streamZoomLevelAction$(
            event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP
          )
        : streamScrollToAction(
            isReverse
              ? { movementX: event.deltaY * -1, movementY: event.deltaX * -1 }
              : { movementX: event.deltaX * -1, movementY: event.deltaY * -1 }
          )
    );
  };

  const handleFit = () => {
    fitDocument(app.store);
  };

  const handleCompass = () => {
    scrollToNearestContent(app.store, 'document');
  };

  onMounted(() => {
    addUnsubscribe(
      measureViewport(app.store, root.value),
      listenSceneHover(canvas.value, press.handleHover)
    );
  });

  return () => {
    const { state } = app.store;
    const { t, locale, dir } = i18n.value;
    // As in Erd: an empty document draws no scrollbar and no map either.
    const showMinimap = hasContent(state);

    return (
      <div
        use:ref={ref(root)}
        class={['erd-view', styles.root]}
        style={{ cursor: press.state.panning ? 'grabbing' : '' }}
        tabindex="0"
        prop:lang={locale}
        prop:dir={dir}
        on:mousedown={press.handlePress}
        on:touchstart={press.handlePress}
        on:wheel={handleWheel}
      >
        <Canvas root={root} canvas={canvas} grabMove={false} />
        <VirtualScroll />
        {showMinimap ? <Minimap /> : null}
        <div class={['view-controls', controls.bar]} prop:dir="ltr">
          {zoom()}
          <div class={controls.divider}></div>
          <div
            class={['view-fit', controls.menu]}
            title={t('visualization.fit')}
            on:click={handleFit}
          >
            <Icon name="fullscreen" size={ICON_SIZE} />
          </div>
          <div class={controls.divider}></div>
          {nameView.trigger()}
          {toolbarCompass({
            compass: getContentCompass(state, 'document'),
            title: t('floatingToolbar.goToContent'),
            className: 'content-compass',
            onClick: handleCompass,
          })}
        </div>
        {nameView.menu()}
        <QuickSearch topLevel={createTableActions} />
        {text.span}
      </div>
    );
  };
};

export default ErdView;
