import {
  ARROW_DOWN_BOX,
  ARROW_UP_BOX,
} from '@/components/erd/welcome-screen/welcomeLayout';

/** The paint of the logo's body, in the ink the editor's own text takes. */
const LOGO_BODY = 'var(--active)';

/** The folded corner, a step down from the body. */
const LOGO_FOLD = 'var(--gray-color-9)';

/** The two tables and the line between them, cut through to the canvas behind. */
const LOGO_CUT = 'var(--canvas-background)';

const EVEN_ODD = 'evenodd';

/**
 * The editor's mark, the file of two joined tables in img/icons, drawn inline
 * so the theme paints it: every shape takes its paint from an inline style,
 * since no stylesheet may declare a fill.
 */
export const welcomeLogo = () => (
  <svg
    class="welcome-screen-logo"
    width="48"
    height="64"
    viewBox="0 0 168 224"
    aria-hidden="true"
  >
    <path
      d="M12 0C5.37258 0 0 5.37258 0 12V212C0 218.627 5.37259 224 12 224H156C162.627 224 168 218.627 168 212V57L138.5 27.5L111 0H12Z"
      style={{ fill: LOGO_BODY, 'fill-rule': EVEN_ODD }}
    ></path>
    <path
      d="M111 12V0L138.5 27.5L168 57H156H153H123C116.373 57 111 51.6274 111 45V15V12Z"
      style={{ fill: LOGO_FOLD, 'fill-rule': EVEN_ODD }}
    ></path>
    <path
      d="M148 124H100V184H148V124ZM142 130H106V178H142V130Z"
      style={{ fill: LOGO_CUT, 'fill-rule': EVEN_ODD }}
    ></path>
    <path
      d="M68 82H20V142H68V82ZM62 88H26V136H62V88Z"
      style={{ fill: LOGO_CUT, 'fill-rule': EVEN_ODD }}
    ></path>
    <rect
      x="82"
      y="111"
      width="4"
      height="44"
      style={{ fill: LOGO_CUT }}
    ></rect>
    <rect
      x="82"
      y="152"
      width="22"
      height="4"
      style={{ fill: LOGO_CUT }}
    ></rect>
    <rect
      x="64"
      y="110"
      width="22"
      height="4"
      style={{ fill: LOGO_CUT }}
    ></rect>
  </svg>
);

/**
 * A pen stroke that leaves the label low on the left and bows up to a tip
 * near the top right, where both barbs meet it, at the tip ARROW_UP_BOX names.
 */
export const ARROW_UP = [
  'M6 69C3.5 50 13.5 31 27 17.5C30.5 13.5 33.6 8.7 36 3',
  'M27.6 8.6Q31.8 5.6 36 3Q36.9 7.9 38.4 12.6',
] as const;

/** A pen stroke that wavers down from under the label to a tip at the bottom middle. */
export const ARROW_DOWN = [
  'M15 3C8.5 15.5 27.5 25 21.5 39C20.5 43.5 20.2 48 20 53',
  'M13.8 45.2Q17.2 48.8 20 53Q22.6 48.6 26.2 45',
] as const;

type ArrowBox = { readonly width: number; readonly height: number };

/**
 * One arrow, stroked from currentColor by attributes, never a stylesheet;
 * mirrored, it is flipped across its own middle, so its tip lands as far in
 * from the left as it stood from the right.
 */
const arrow = (
  box: ArrowBox,
  paths: ReadonlyArray<string>,
  mirrored: boolean
) => (
  <svg
    class="welcome-screen-arrow"
    width={box.width}
    height={box.height}
    viewBox={`0 0 ${box.width} ${box.height}`}
    aria-hidden="true"
  >
    <g transform={mirrored ? `matrix(-1 0 0 1 ${box.width} 0)` : ''}>
      {paths.map(d => (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      ))}
    </g>
  </svg>
);

export const arrowUp = (mirrored: boolean) =>
  arrow(ARROW_UP_BOX, ARROW_UP, mirrored);

export const arrowDown = () => arrow(ARROW_DOWN_BOX, ARROW_DOWN, false);
