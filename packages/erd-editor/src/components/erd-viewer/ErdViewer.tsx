import { parser, toDocumentJson } from '@dineug/erd-editor-schema';
import {
  createCustomElement,
  createRef,
  FC,
  nextTick,
  observable,
  observer,
  onBeforeMount,
  onMounted,
  onUnmounted,
  ref,
  render,
  useProvider,
  watch,
} from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import type { CustomElementClass } from '@/components/customElementClass';
import { useLocaleHost } from '@/components/element-host/localeHost';
import { useThemeHost } from '@/components/element-host/themeHost';
import ErdView from '@/components/erd-view/ErdView';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import { localeContext } from '@/components/localeContext';
import Theme from '@/components/theme/Theme';
import { themeContext } from '@/components/themeContext';
import { CANVAS_ZOOM_MAX, type NameViewMode } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { lazyMessagesOf } from '@/i18n/loadMessages';
import { type LocaleOption, SYSTEM_LOCALE } from '@/i18n/locales';
import type { ValuesType } from '@/internal-types';
import { fitDocument } from '@/konva/scene/fitZoom';
import { observeThemeOverrides, resolveHostTheme } from '@/konva/theme';
import {
  Appearance,
  SYSTEM_APPEARANCE,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { Theme as ThemeType } from '@/themes/tokens';
import { toLoadValue } from '@/utils/loadValue';
import { hasNameViewMode } from '@/utils/validation';

import { createDocumentSource } from './documentSource';

declare global {
  interface HTMLElementTagNameMap {
    'erd-viewer': ErdViewerElement;
  }
}

type NameView = ValuesType<typeof NameViewMode>;

export type ErdViewerProps = {
  /**
   * The url of a document in the form a file saves, fetched with GET under the
   * browser's CORS rules; empty for none. Whichever of it and value is set last
   * wins, and a fetch still running when the element leaves the page is aborted.
   */
  src: string;
  /** The name view the attribute shows over the document's own; null shows the document's. */
  nameView: NameView | null;
  /** Whether the minimap shows; the attribute turns it off only as "false". */
  minimap: boolean;
  /** Whether the view controls show; the attribute turns them off only as "false". */
  controls: boolean;
};

export interface ErdViewerElement extends ErdViewerProps, HTMLElement {
  /**
   * The document as a file saves it, which keeps the file's zoom and scroll
   * while it locks its viewport, as a new one does, and the reader's otherwise.
   * Setting one replaces the document and cancels a src fetch; text with none throws.
   */
  value: string;
  setPresetTheme: (themeOptions: Partial<ThemeOptions>) => void;
  /** What the system appearance shows, for a page with its own light and dark; null follows the OS. */
  setSystemAppearance: (appearance: Appearance | null) => void;
  setTheme: (theme: Partial<ThemeType>) => void;
  /**
   * 'system', the default, reads the page's html lang, then navigator.languages,
   * as the element first connected; a code fixes one. Resolves once its dictionary
   * has landed or failed, leaving it or English in force unless a later call won.
   */
  setLocale: (locale: LocaleOption) => Promise<void>;
  /**
   * What system means: a BCP 47 tag, or null for the page's languages read as
   * the element first connected. Resolves as setLocale does.
   */
  setSystemLocale: (locale: string | null) => Promise<void>;
  /**
   * Ends the viewer: takes the view down at once, in the page or out of it,
   * aborts a fetch still running, lets the OS color scheme and the page's
   * styles go and draws nothing more, connected again or not.
   */
  destroy: () => void;
}

/** What a page may have set on the element before it was defined, which the accessors below would hide. */
const UPGRADED_PROPERTIES = [
  'value',
  'src',
  'nameView',
  'minimap',
  'controls',
] as const;

/**
 * Takes the own properties a page set on the element before it was defined
 * off it, in the order it first wrote each, the one trace its writes leave, so
 * the accessors the class and the setup define take them up, the later winning.
 */
function takeOwnProperties(element: HTMLElement): Array<[string, unknown]> {
  const upgraded: ReadonlyArray<PropertyKey> = UPGRADED_PROPERTIES;
  const taken: Array<[string, unknown]> = [];

  for (const name of Reflect.ownKeys(element)) {
    if (typeof name !== 'string' || !upgraded.includes(name)) continue;

    taken.push([name, Reflect.get(element, name)]);
    Reflect.deleteProperty(element, name);
  }

  return taken;
}

/** The tags the system option reads: the page's html lang first, then the browser's. */
const readPageLanguages = (element: HTMLElement): string[] =>
  [element.ownerDocument.documentElement.lang, ...navigator.languages].filter(
    Boolean
  );

/** Where the latest src stands: none to follow, its document still to take, or taken. */
type SrcState = 'none' | 'pending' | 'applied';

const ErdViewer: FC<ErdViewerProps, ErdViewerElement> = (props, ctx) => {
  let early = takeOwnProperties(ctx);
  let destroyed = false;

  /**
   * Sets what the page wrote before the tag was defined through the accessors,
   * once and in the order it wrote each. A value that holds no document cannot
   * throw to that page any more, so it is thrown in a microtask as its own error.
   */
  const takeUpEarly = () => {
    const taken = early;
    early = [];
    for (const [name, value] of taken) {
      try {
        Reflect.set(ctx, name, value);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  };

  const themeHost = useThemeHost({ appearance: SYSTEM_APPEARANCE });
  const { theme } = themeHost;

  // The page's languages are read once, as the element first connects, and
  // never again: a languagechange the page hears moves no viewer, nor does a
  // first connect once the viewer is destroyed.
  const pageLanguages = observable<{ languages: string[] }>(
    { languages: [] },
    { shallow: true }
  );
  let languagesRead = false;
  onBeforeMount(() => {
    if (destroyed || languagesRead) return;
    languagesRead = true;
    pageLanguages.languages = readPageLanguages(ctx);
  });

  const localeHost = useLocaleHost({
    messagesOf: lazyMessagesOf,
    languages: { state: pageLanguages },
    fallbackOption: () => SYSTEM_LOCALE,
  });

  // Konva resolves no custom property, so the scene reads the palette as values
  // off this provider: the cascade's answer, so an --erd-editor-* override
  // reaches a painted node, as it does in the editor.
  const sceneTheme = observable<ThemeType>({ ...theme }, { shallow: true });
  const themeProvider = useProvider(ctx, themeContext, sceneTheme);
  const localeProvider = useProvider(ctx, localeContext, localeHost.i18n);

  const resolveSceneTheme = () => {
    Object.assign(sceneTheme, resolveHostTheme(ctx, theme));
  };
  const scheduleSceneTheme = () => {
    nextTick(resolveSceneTheme);
  };

  const appRef = createRef<AppContext | null>(null);
  const live = (): AppContext | null => (destroyed ? null : appRef.value);
  const wrapper = createRef<HTMLDivElement>();
  let stopView: (() => void) | null = null;

  // The document's load text, which a view not built yet takes as it mounts,
  // and whether the view has taken it.
  let held = toLoadValue('');
  let heldApplied = false;
  let followedSrc = '';
  let srcState: SrcState = 'none';
  // A src written again while a value stands in its place, which followSrc
  // takes up even when the url is the one it followed.
  let srcRewritten = false;
  let fitPending = false;
  let documentNameView: NameView | null = null;
  let stopOverrides: (() => void) | null = null;
  let stopViewport: (() => void) | null = null;

  /**
   * The view's store as a file saves it, with the document's own name view in
   * place of the one shown over it, which a file whose name view lock is off
   * would take otherwise.
   */
  const documentJsonOf = ({ store: { state } }: AppContext) =>
    toDocumentJson({
      ...state,
      settings: {
        ...state.settings,
        nameViewMode: documentNameView ?? state.settings.nameViewMode,
      },
    });

  /** Shows the name view the attribute names, or the document's once it names none. */
  const showNameView = () => {
    const app = live();
    const value = props.nameView ?? documentNameView;
    if (!app || !value || app.store.state.settings.nameViewMode === value) {
      return;
    }

    app.store.dispatchSync(toNameViewModeAction(app.store.state, value, true));
  };

  /** Fits the document to the screen once the view has one, the file's own zoom and origin left aside. */
  const fitWhenMeasured = () => {
    const app = live();
    if (!app || !fitPending) return;

    const { width, height } = app.store.state.editor.viewport;
    if (width <= 0 || height <= 0) return;

    fitPending = false;
    fitDocument(app.store, CANVAS_ZOOM_MAX);
  };

  const loadIntoView = (app: AppContext) => {
    app.store.dispatchSync(initialLoadJsonAction$(held));
    heldApplied = true;
    documentNameView = app.store.state.settings.nameViewMode;
    showNameView();
    fitPending = true;
    fitWhenMeasured();
  };

  /** Holds a document checked to parse, and puts it in the view where there is one. */
  const takeDocument = (loadValue: string) => {
    held = loadValue;
    heldApplied = false;
    const app = live();
    if (app) loadIntoView(app);
  };

  const source = createDocumentSource({
    apply: text => {
      parser(text);
      srcState = 'applied';
      takeDocument(toLoadValue(text));
    },
    onLoad: () => {
      ctx.dispatchEvent(new CustomEvent('load'));
    },
    onError: cause => {
      takeDocument(toLoadValue(''));
      ctx.dispatchEvent(new CustomEvent('error', { detail: cause }));
    },
  });

  /**
   * Takes up a src the page changed, or wrote again over a value, since the
   * viewer last looked. Read off the props, which the attribute and the property
   * both write at once, so a value set after a src, before it is heard, wins.
   */
  const followSrc = () => {
    if (props.src === followedSrc && !srcRewritten) return;

    srcRewritten = false;
    followedSrc = props.src;
    source.cancel();
    srcState = followedSrc ? 'pending' : 'none';
  };

  /** Fetches the src whose document the view has not taken, while the element is in a page. */
  const fetchPending = () => {
    if (srcState !== 'pending' || !live() || !ctx.isConnected) return;
    if (source.state.status === 'loading') return;

    void source.load(followedSrc);
  };

  /**
   * Takes up a src written while a value stands in its place as a change, since
   * the props hear no write of the url they already hold, so the later of the
   * two wins even when the url is the one followed before the value.
   */
  const rewriteSrc = () => {
    if (destroyed || srcState !== 'none' || !props.src) return;

    srcRewritten = true;
    nextTick(() => {
      followSrc();
      fetchPending();
    });
  };

  // Both ways a page writes a src: the property here, and the attribute, whose
  // writes, the same value's included, only this observer hears.
  Object.defineProperty(ctx, 'src', {
    get: () => {
      takeUpEarly();
      return props.src;
    },
    set: (src: string) => {
      takeUpEarly();
      Reflect.set(props, 'src', src);
      rewriteSrc();
    },
  });
  const srcAttribute = new MutationObserver(rewriteSrc);
  srcAttribute.observe(ctx, { attributeFilter: ['src'] });

  Object.defineProperty(ctx, 'value', {
    get: () => {
      takeUpEarly();
      const app = live();
      return app ? documentJsonOf(app) : toDocumentJson(parser(held));
    },
    set: (value: string) => {
      takeUpEarly();
      const loadValue = toLoadValue(value);
      // Thrown here, before anything changes, for text that holds no document.
      parser(loadValue);

      // A src attribute written before this value is the earlier of the two.
      srcAttribute.takeRecords();
      srcRewritten = false;
      followedSrc = props.src;
      source.cancel();
      srcState = 'none';
      takeDocument(loadValue);
    },
  });

  const unwatch = [
    watch(theme).subscribe(scheduleSceneTheme),
    watch(props).subscribe(propName => {
      if (propName === 'nameView') {
        showNameView();
      } else if (propName === 'src') {
        followSrc();
        fetchPending();
      }
    }),
  ];

  /**
   * Draws the view into its wrapper through a render of its own: the element's
   * runs only while it is connected and a removal drops the one it queued, so
   * only a render the viewer holds lets destroy take the view down at once.
   */
  const drawView = () => {
    const target = wrapper.value;
    if (stopView || destroyed || !target) return;

    stopView = observer(() =>
      render(
        target,
        <ErdView
          appRef={appRef}
          minimap={props.minimap}
          controls={props.controls}
          status={source.state.status}
        />
      )
    );
  };

  const destroy = () => {
    if (destroyed) return;

    const app = appRef.value;
    if (app) held = documentJsonOf(app);
    destroyed = true;
    // The view stops its transitions, drops its light, destroys its app and
    // lets its stages go as it unmounts, here, in the page or out of it.
    stopView?.();
    stopView = null;
    if (wrapper.value) render(wrapper.value, null);
    srcState = 'none';
    source.cancel();
    srcAttribute.disconnect();
    stopOverrides?.();
    stopOverrides = null;
    stopViewport?.();
    stopViewport = null;
    unwatch.forEach(unsubscribe => unsubscribe());
    themeHost.destroy();
    localeHost.destroy();
    themeProvider.destroy();
    localeProvider.destroy();
  };

  onMounted(() => {
    drawView();
    const app = live();
    if (!app) return;

    resolveSceneTheme();
    stopOverrides = observeThemeOverrides(ctx, scheduleSceneTheme);
    stopViewport ??= app.store.subscribe(actions => {
      if (actions.some(({ type }) => type === changeViewportAction.type)) {
        fitWhenMeasured();
      }
    });

    if (!heldApplied) loadIntoView(app);
    followSrc();
    fetchPending();
  });

  // Out of the page a fetch stops, and the next connect asks for it again.
  onUnmounted(() => {
    stopOverrides?.();
    stopOverrides = null;
    source.cancel();
  });

  ctx.setPresetTheme = themeHost.setPresetTheme;
  ctx.setSystemAppearance = themeHost.setSystemAppearance;
  ctx.setTheme = themeHost.setTheme;
  ctx.setLocale = localeHost.setLocale;
  ctx.setSystemLocale = localeHost.setSystemLocale;
  ctx.destroy = destroy;

  // An upgrade reports the markup's attributes after this setup, and they are
  // older than any property the page wrote, so those wait for the first connect
  // that follows, a microtask out of a page, or the page's next value or src.
  onBeforeMount(takeUpEarly);
  if (early.length && !ctx.isConnected) queueMicrotask(takeUpEarly);

  // ErdView provides its app on the element it is mounted in, which holds it
  // alone and takes no box of its own.
  return () => (
    <>
      <GlobalStyles />
      <Theme theme={theme} />
      <div use:ref={ref(wrapper)} style={{ display: 'contents' }}></div>
    </>
  );
};

const TAG_NAME = 'erd-viewer';

/**
 * A part on by default that only the attribute value "false" turns off, so
 * removing the attribute or writing it bare shows the part again.
 */
const shownUnlessFalse = {
  type: (value: string | null) => value !== 'false',
  default: true,
};

/**
 * The element class, which nothing registers until defineErdViewer() runs or
 * a caller defines it under a tag of its own.
 */
export const ErdViewerElement: CustomElementClass<ErdViewerElement> =
  /* @__PURE__ */ createCustomElement<ErdViewerProps, ErdViewerElement>({
    shadow: 'closed',
    observedProps: {
      src: { type: (value: string | null) => value ?? '', default: '' },
      nameView: {
        type: (value: string | null) =>
          value !== null && hasNameViewMode(value) ? value : null,
        default: null,
      },
      minimap: shownUnlessFalse,
      controls: shownUnlessFalse,
    },
    render: ErdViewer,
  });

/**
 * Defines erd-viewer as ErdViewerElement. A second call leaves the definition
 * as it is, and a tag another class already holds throws, naming the tag.
 */
export function defineErdViewer(): void {
  const defined = customElements.get(TAG_NAME);

  if (defined === ErdViewerElement) {
    return;
  }

  if (defined) {
    throw new Error(
      `Another element class already defines the custom element name ${TAG_NAME}`
    );
  }

  customElements.define(TAG_NAME, ErdViewerElement);
}
