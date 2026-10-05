import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  onUnmounted,
  ref,
} from '@dineug/r-html';
import { clamp } from 'es-toolkit';

import Icon from '@/components/primitives/icon/Icon';
import { hasMoveKeys, Viewport } from '@/engine/modules/editor/state';
import { onNumberOnly, onStop } from '@/utils/domEvent';
import { focusEvent } from '@/utils/internalEvents';
import {
  isComposing,
  KeyBindingMap,
  KeyBindingName,
  KeyBindingNameList,
  matchesShortcut,
  PANEL_PASSING_BINDINGS,
} from '@/utils/keyboard-shortcut';
import { toOpaqueHex } from '@/utils/tableColor';
import { isEditableTarget } from '@/utils/validation';

import {
  hexToHsv,
  Hsv,
  hsvToHex,
  hsvToRgb,
  isCompleteHexInput,
  parseChannelInput,
  parseHexInput,
  rgbToHsv,
  stepArea,
  stepHue,
} from './colorModel';
import * as styles from './ColorPicker.styles';
import { ColorSwatch, PRESET_COLORS } from './presetColors';
import { resolveColor } from './resolveColor';

export type ColorPickerProps = {
  x: number;
  y: number;
  /** The color it opens on, in any form a document holds; an empty or unreadable one shows no value. */
  color: string;
  viewport?: Viewport | null;
  /** The editor's live bindings, which decide what a press inside keeps from the editor. */
  keyBindingMap: KeyBindingMap;
  /** Opaque #rrggbb colors the document already uses, most used first. */
  documentColors?: ReadonlyArray<string>;
  onChange?: (color: string) => void;
  /** Shows a No color row at the foot of the panel, which calls this when pressed. */
  onClear?: () => void;
  /** Called on Escape; the parent closes the picker. */
  onClose?: () => void;
};

/** How many of the document's colors the row shows, the most used first. */
const DOCUMENT_COLOR_LIMIT = 8;

/** The columns of a swatch grid, which the up and down keys move across. */
const SWATCH_COLUMNS = 8;

/** Where the area and the hue stand while no color is shown: full red. */
const FALLBACK_HSV: Hsv = { h: 0, s: 1, v: 1 };

/** A pipette that fails sooner than a person could press Escape has no chooser behind it. */
const EYEDROPPER_DEAD_MS = 150;

/** What Tab stops on inside the panel, in document order. */
const TABBABLE = '[tabindex="0"], input, button:not([tabindex="-1"])';

type EyeDropperConstructor = new () => {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
};

/** The EyeDropper API where the browser has one, desktop Chromium alone today; lib.dom declares none yet. */
const getEyeDropper = () =>
  (globalThis as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

type Field = 'hex' | 'r' | 'g' | 'b';

type Draft = { field: Field; text: string };

type ActiveKey = 'presetActive' | 'documentActive';

type Ratio = { x: number; y: number };

const CHANNELS = [
  { field: 'r', label: 'R', title: 'Red, 0 to 255' },
  { field: 'g', label: 'G', title: 'Green, 0 to 255' },
  { field: 'b', label: 'B', title: 'Blue, 0 to 255' },
] as const;

const CHANNEL_INDEX: Record<Exclude<Field, 'hex'>, number> = {
  r: 0,
  g: 1,
  b: 2,
};

/** Where a pointer stands across and down a box, each 0 to 1; null for a box with no size. */
const ratioOf = (event: PointerEvent): Ratio | null => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
};

/**
 * The swatch a key moves to, as radio buttons in a grid move: left and right
 * stop at either end, up and down stay put past the first or last row; null
 * for a key the group does not take.
 */
const stepSwatch = (index: number, count: number, key: string) => {
  switch (key) {
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowRight':
      return Math.min(index + 1, count - 1);
    case 'ArrowUp':
      return index < SWATCH_COLUMNS ? index : index - SWATCH_COLUMNS;
    case 'ArrowDown':
      return index + SWATCH_COLUMNS < count ? index + SWATCH_COLUMNS : index;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};

const ColorPicker: FC<ColorPickerProps> = (props, ctx) => {
  const container = createRef<HTMLDivElement>();
  const panel = createRef<HTMLDivElement>();
  const hue = createRef<HTMLDivElement>();
  const eyeDropperButton = createRef<HTMLButtonElement>();
  const EyeDropperApi = getEyeDropper();
  const initial = resolveColor(props.color ?? '');
  const start = initial ? hexToHsv(initial, FALLBACK_HSV) : FALLBACK_HSV;
  const state = observable({
    x: props.x,
    y: props.y,
    h: start.h,
    s: start.s,
    v: start.v,
    empty: initial === null,
    draft: null as Draft | null,
    eyeDropper: Boolean(EyeDropperApi),
    presetActive: 0,
    documentActive: 0,
  });
  let eyeDropperAbort: AbortController | null = null;

  const hsv = (): Hsv => ({ h: state.h, s: state.s, v: state.v });

  /** The color on show as #rrggbb, null while it shows none. */
  const currentHex = () => (state.empty ? null : hsvToHex(hsv()));

  /**
   * A drag, a held key or a typed hex hands on a color only when it changes;
   * a press, a swatch, a committed field or the pipette always does, so a
   * color an undo or a peer took back can be put on again.
   */
  const update = (next: Hsv, discrete: boolean) => {
    const before = currentHex();
    state.h = next.h;
    state.s = next.s;
    state.v = next.v;
    state.empty = false;

    const hex = hsvToHex(next);
    if (discrete || hex !== before) {
      props.onChange?.(hex);
    }
  };

  const shown = (field: Field): string => {
    if (state.empty) return '';
    return field === 'hex'
      ? hsvToHex(hsv()).slice(1).toUpperCase()
      : String(hsvToRgb(hsv())[CHANNEL_INDEX[field]]);
  };

  /** What a field shows: the text typed into it until committed or left, else the color. */
  const valueOf = (field: Field) =>
    state.draft?.field === field ? state.draft.text : shown(field);

  const press =
    (apply: (ratio: Ratio, discrete: boolean) => void) =>
    (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;

      const el = event.currentTarget as HTMLElement;
      el.focus({ preventScroll: true });
      el.setPointerCapture(event.pointerId);
      const ratio = ratioOf(event);
      if (ratio) apply(ratio, true);
    };

  const drag =
    (apply: (ratio: Ratio, discrete: boolean) => void) =>
    (event: PointerEvent) => {
      const el = event.currentTarget as HTMLElement;
      if (!el.hasPointerCapture(event.pointerId)) return;

      const ratio = ratioOf(event);
      if (ratio) apply(ratio, false);
    };

  const applyArea = ({ x, y }: Ratio, discrete: boolean) =>
    update({ ...hsv(), s: x, v: 1 - y }, discrete);

  const applyHue = ({ x }: Ratio, discrete: boolean) =>
    update({ ...hsv(), h: x * 360 }, discrete);

  const handleAreaPointerdown = press(applyArea);
  const handleAreaPointermove = drag(applyArea);
  const handleHuePointerdown = press(applyHue);
  const handleHuePointermove = drag(applyHue);

  /**
   * A slider takes its keys with no modifier but Shift, which steps ten at a
   * time. Space does nothing here but is spent, as a host page would scroll.
   */
  const stepWith = (event: KeyboardEvent, step: () => Hsv | null) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const next = step();
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    update(next, false);
  };

  const handleAreaKeydown = (event: KeyboardEvent) =>
    stepWith(event, () => stepArea(hsv(), event.key, event.shiftKey));

  const handleHueKeydown = (event: KeyboardEvent) =>
    stepWith(event, () => {
      const h = stepHue(state.h, event.key, event.shiftKey);
      return h === null ? null : { ...hsv(), h };
    });

  /**
   * Parses a field only once its text differs from what it shows, so Enter in
   * a field left as it was hands on nothing; text that reads as no color is
   * dropped, and the field shows the color again.
   */
  const commit = (field: Field) => {
    const { draft } = state;

    if (draft?.field === field && draft.text !== shown(field)) {
      if (field === 'hex') {
        const hex = parseHexInput(draft.text) ?? resolveColor(draft.text);
        if (hex) update(hexToHsv(hex, hsv()), true);
      } else {
        const value = parseChannelInput(draft.text);
        if (value !== null) {
          const rgb = hsvToRgb(hsv());
          rgb[CHANNEL_INDEX[field]] = value;
          update(rgbToHsv(rgb, hsv()), true);
        }
      }
    }

    state.draft = null;
  };

  const createFieldHandlers = (field: Field) => ({
    input: (event: Event) => {
      if (field !== 'hex') onNumberOnly(event as InputEvent);

      const text = (event.target as HTMLInputElement).value;
      state.draft = { field, text };
      if (field === 'hex' && isCompleteHexInput(text)) {
        update(hexToHsv(parseHexInput(text) as string, hsv()), false);
      }
    },
    change: () => commit(field),
    keydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isComposing(event)) commit(field);
    },
    blur: () => {
      state.draft = null;
    },
  });

  const fieldHandlers: Record<Field, ReturnType<typeof createFieldHandlers>> = {
    hex: createFieldHandlers('hex'),
    r: createFieldHandlers('r'),
    g: createFieldHandlers('g'),
    b: createFieldHandlers('b'),
  };

  /** Moving through a radio group selects as it goes, each step a color change. */
  const handleSwatchKeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const group = event.currentTarget as HTMLElement;
    const buttons = Array.from(group.querySelectorAll('button'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = stepSwatch(index, buttons.length, event.key);
    if (next === null) return;

    event.preventDefault();
    event.stopPropagation();
    if (next === index) return;

    buttons[next].focus();
    buttons[next].click();
  };

  /**
   * An embedder with no chooser behind the API fails at once, so the button
   * goes for the rest of this opening, handing its focus to the hue first, as
   * a focused button removed drops the keyboard to the page.
   */
  const handleEyeDropper = () => {
    eyeDropperAbort?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    eyeDropperAbort = controller;
    const started = performance.now();

    new (EyeDropperApi as EyeDropperConstructor)().open({ signal }).then(
      ({ sRGBHex }) => {
        const hex = toOpaqueHex(sRGBHex);
        if (!signal.aborted && hex) update(hexToHsv(hex, hsv()), true);
      },
      (error: unknown) => {
        const name = (error as { name?: string } | null)?.name;
        const dead =
          name === 'OperationError' ||
          (name === 'AbortError' &&
            !signal.aborted &&
            performance.now() - started < EYEDROPPER_DEAD_MS);
        if (!dead) return;

        const button = eyeDropperButton.value;
        const root = button?.getRootNode() as Document | ShadowRoot | undefined;
        if (root?.activeElement === button) {
          hue.value.focus({ preventScroll: true });
        }
        state.eyeDropper = false;
      }
    );
  };

  /**
   * Turns Tab round at either end of the panel, a radio group counting as one
   * stop, so the keyboard stays with the picker until it closes.
   */
  const keepTabInside = (event: KeyboardEvent) => {
    const $panel = panel.value;
    const controls = $panel.querySelectorAll<HTMLElement>(TABBABLE);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const { activeElement } = $panel.getRootNode() as Document | ShadowRoot;
    const atEnd = event.shiftKey
      ? activeElement === first || activeElement === $panel
      : activeElement === last ||
        Boolean(last.closest('[role="radiogroup"]')?.contains(activeElement));
    if (!atEnd) return;

    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  };

  /**
   * Keeps from the canvas its shortcuts bar PANEL_PASSING_BINDINGS, cancelled
   * as it cancels them but in a field or as a button's Space or Enter, and the
   * arrows and Tab, and closes on Escape. Other presses go on to the host.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const matches = (name: KeyBindingName) =>
      matchesShortcut(event, props.keyBindingMap[name]);

    if (isComposing(event)) {
      event.stopPropagation();
      return;
    }

    if (matches(KeyBindingName.stop)) {
      event.preventDefault();
      event.stopPropagation();
      props.onClose?.();
      return;
    }

    if (event.key === 'Tab') keepTabInside(event);

    const bound = KeyBindingNameList.some(matches);
    if (
      !PANEL_PASSING_BINDINGS.some(matches) &&
      (hasMoveKeys(event.key) || bound)
    ) {
      event.stopPropagation();
      const buttonPress =
        event.target instanceof HTMLButtonElement &&
        (event.key === ' ' || event.key === 'Enter');
      if (bound && !isEditableTarget(event.target) && !buttonPress) {
        event.preventDefault();
      }
    }
  };

  /** Spent here, as the canvas behind would zoom or the page scroll; nothing in the panel scrolls. */
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /** The canvas menu stays shut over the panel, while a field keeps the browser's own. */
  const handleContextmenu = (event: MouseEvent) => {
    event.stopPropagation();
    if ((event.target as HTMLElement).tagName !== 'INPUT') {
      event.preventDefault();
    }
  };

  onMounted(() => {
    const $container = container.value;

    if (props.viewport) {
      const rect = $container.getBoundingClientRect();
      const width = props.x + rect.width;
      const height = props.y + rect.height;

      if (props.viewport.width < width) {
        const x = props.viewport.width - rect.width;
        if (0 <= x) {
          state.x = x;
        }
      }
      if (props.viewport.height < height) {
        const y = props.viewport.height - rect.height;
        if (0 <= y) {
          state.y = y;
        }
      }
    }

    panel.value.focus({ preventScroll: true });
  });

  onUnmounted(() => {
    eyeDropperAbort?.abort();
    // The keyboard was inside the panel and leaves with it, so it is handed
    // back on every way out, the ones the parent closes it by included.
    const host = ctx.host;
    nextTick(() => {
      host.dispatchEvent(focusEvent());
    });
  });

  const renderSwatches = (
    groupLabel: string,
    swatches: ReadonlyArray<ColorSwatch>,
    activeKey: ActiveKey
  ) => {
    const current = currentHex();
    const checked = swatches.findIndex(({ color }) => color === current);
    const roving = checked === -1 ? state[activeKey] : checked;

    return (
      <div
        class={styles.swatches}
        role="radiogroup"
        aria-label={groupLabel}
        on:keydown={handleSwatchKeydown}
      >
        {swatches.map(({ color, label }, index) => (
          <button
            class={styles.swatch}
            type="button"
            role="radio"
            aria-label={label}
            aria-checked={String(color === current)}
            title={color.toUpperCase()}
            tabindex={index === roving ? 0 : -1}
            style={{ 'background-color': color }}
            on:click={() => update(hexToHsv(color, hsv()), true)}
            on:focus={() => {
              state[activeKey] = index;
            }}
          ></button>
        ))}
      </div>
    );
  };

  return () => {
    const { empty } = state;
    const saturation = Math.round(state.s * 100);
    const brightness = Math.round(state.v * 100);
    const degrees = Math.round(state.h);
    const documentColors = (props.documentColors ?? [])
      .slice(0, DOCUMENT_COLOR_LIMIT)
      .map(color => ({ color, label: color.toUpperCase() }));

    return (
      <div
        class={['color-picker', styles.container]}
        style={{
          top: `${state.y}px`,
          left: `${state.x}px`,
        }}
        use:ref={ref(container)}
      >
        <div
          class={styles.panel}
          role="dialog"
          aria-label="Color"
          tabindex="-1"
          use:ref={ref(panel)}
          on:keydown={handleKeydown}
          on:wheel={handleWheel}
          on:contextmenu={handleContextmenu}
          on:touchstart={onStop}
          on:copy={onStop}
          on:paste={onStop}
        >
          <div class={styles.body}>
            <div
              class={styles.area}
              role="slider"
              tabindex="0"
              aria-label="Saturation and brightness"
              aria-roledescription="2D slider"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={saturation}
              aria-valuetext={
                empty
                  ? 'No color'
                  : `Saturation ${saturation}%, brightness ${brightness}%`
              }
              style={{
                'background-color': hsvToHex({ h: state.h, s: 1, v: 1 }),
              }}
              on:pointerdown={handleAreaPointerdown}
              on:pointermove={handleAreaPointermove}
              on:keydown={handleAreaKeydown}
            >
              <div
                class={styles.areaThumb}
                style={{
                  left: `${state.s * 100}%`,
                  top: `${(1 - state.v) * 100}%`,
                }}
              ></div>
            </div>
            <div class={styles.controls}>
              {state.eyeDropper ? (
                <button
                  class={styles.iconButton}
                  type="button"
                  aria-label="Pick a color from the screen"
                  title="Pick a color from the screen"
                  use:ref={ref(eyeDropperButton)}
                  on:click={handleEyeDropper}
                >
                  <Icon name="pipette" size={16} />
                </button>
              ) : null}
              <div
                class={styles.hue}
                role="slider"
                tabindex="0"
                aria-label="Hue"
                aria-valuemin="0"
                aria-valuemax="360"
                aria-valuenow={degrees}
                aria-valuetext={empty ? 'No color' : `${degrees} degrees`}
                use:ref={ref(hue)}
                on:pointerdown={handleHuePointerdown}
                on:pointermove={handleHuePointermove}
                on:keydown={handleHueKeydown}
              >
                <div
                  class={styles.hueThumb}
                  style={{ left: `${(state.h / 360) * 100}%` }}
                ></div>
              </div>
              <div
                class={styles.preview}
                aria-hidden="true"
                style={{ 'background-color': currentHex() ?? '' }}
              ></div>
            </div>
          </div>
          <div class={styles.fields}>
            <label class={styles.hexField}>
              <input
                class={styles.input}
                type="text"
                aria-label="Hex"
                placeholder={empty ? 'None' : ''}
                spellcheck="false"
                autocomplete="off"
                prop:value={valueOf('hex')}
                on:input={fieldHandlers.hex.input}
                on:change={fieldHandlers.hex.change}
                on:keydown={fieldHandlers.hex.keydown}
                on:blur={fieldHandlers.hex.blur}
              />
              <span class={styles.fieldLabel} aria-hidden="true">
                Hex
              </span>
            </label>
            {CHANNELS.map(({ field, label, title }) => (
              <label class={styles.field}>
                <input
                  class={styles.input}
                  type="text"
                  aria-label={label}
                  title={title}
                  inputmode="numeric"
                  maxlength={3}
                  spellcheck="false"
                  autocomplete="off"
                  prop:value={valueOf(field)}
                  on:input={fieldHandlers[field].input}
                  on:change={fieldHandlers[field].change}
                  on:keydown={fieldHandlers[field].keydown}
                  on:blur={fieldHandlers[field].blur}
                />
                <span class={styles.fieldLabel} aria-hidden="true">
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div class={styles.swatchArea}>
            {renderSwatches('Presets', PRESET_COLORS, 'presetActive')}
            {documentColors.length ? (
              <>
                <div class={styles.caption} aria-hidden="true">
                  Document colors
                </div>
                {renderSwatches(
                  'Document colors',
                  documentColors,
                  'documentActive'
                )}
              </>
            ) : null}
          </div>
          {props.onClear ? (
            <button class={styles.clear} type="button" on:click={props.onClear}>
              No color
            </button>
          ) : null}
        </div>
      </div>
    );
  };
};

export default ColorPicker;
